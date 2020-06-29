/*
ItchIo.gs contains 3 functions:

update_ItchIo_Scores()
  Reads the games in <Sheet_Raw_Data> and updates the Itch.io scores
  Calls ItchIo_search()

ItchIo_search(game_title)
  This looks up Itch.io and returns an 1D array of [game_title, game_link] when searching for <game>
  Returns <null> if no games found
  Calls ItchIo_game()

ItchIo_game(game_name+, game_link)
  This looks up Itch.io and returns a 1D array of [rating, review_count] when looking up <game_link>
  Returns <null> if game, ratings, or review_count are not found

*/

//////////////////////
//
// Reads the games in <Sheet_Raw_Data> and updates the Itch.io scores
// <force_try>: If 1: Will try to scrape data for any row without scores, regardless of timestamp
//              If 0: Will only scrape data for any row without a recent timestamp
//
//////////////////////
function update_ItchIo_Scores(force_try) {
  var function_name = "update_ItchIo_Scores()";
  
  // Optional argument: force_try; default: 0
  if (typeof(force_try) == "undefined") {
    force_try = 0;
  }
  
  var query_count = 0;         // Keep track of how many website queries are made. Don't exceed <max_queries> per run
  
  // Start timer
  var function_Timer1 = Date.now();
  if (debug_mode || info_mode) {
    Logger.log("Starting " + function_name);
  }
  
  // Open the <Sheet_Raw_Data> sheet
  try {
    var sheet = SpreadsheetApp.openById(FileID_This_Sheet).getSheetByName(Sheet_Raw_Data);
    var range = sheet.getDataRange();
    var sheet_data = range.getValues();
  }
  catch (e) {
    var err_msg = function_name + " - Couldn't open \"" + sheet.getName() + "\" sheet: " + e;
    Logger.log(err_msg);
    Browser.msgBox(err_msg);
    
    return 0;
  }
  
  // Get Column Headers
  try {
    var header_row = sheet_data[0];
    if (debug_mode) {
      Logger.log(header_row);
    }
    
    // Get Column numbers
    var col_Game_Title            = header_row.indexOf(Header_Game_Title);
    var col_Itchio_Rating         = header_row.indexOf(Header_Itchio_Rating);
    var col_Itchio_ReviewCount    = header_row.indexOf(Header_Itchio_ReviewCount);
    var col_Itchio_UpdateTime    = header_row.indexOf(Header_Itchio_UpdateTime);
    
    // Log header columns. Missing headers will be -1
    var col_headers = [col_Game_Title, col_Itchio_Rating, col_Itchio_Rating];
    if (debug_mode) {
      Logger.log(col_headers.join(' ') + "\n");
    }
    
    // Quit if any headers don't match or are missing
    col_headers.forEach(function(col_head, index) {
      if (col_head == -1) {
        throw(function_name + " - Couldn't find all column headers. Index " + index + " of col_headers is wrong. Check script logs that header variables match headers.");
      }
    });
  }
  catch(e) {
    Logger.log(e);
    Browser.msgBox(e);
    
    return 0;
  }
  
  // Iterate through the sheets rows and update them
  try {
    for (var rnum = 0; rnum < sheet_data.length; rnum++) {
      
      var srow          = sheet_data[rnum];
      var game_name     = srow[col_Game_Title];
      
      if ((game_name != "") && (game_name != Header_Game_Title)) {
        if (debug_mode) {
          Logger.log("Starting " + game_name);
        }
        
        // Get the last time the row was updated. If the row was already updated within the <Update_period>, skip the row
        var last_updated  = srow[col_Itchio_UpdateTime];
        var current_rating  = srow[col_Itchio_Rating];
        
        if ((last_updated != null) && (last_updated != "")) {
          var time_diff = (function_Timer1 - last_updated)/(1000 * 3600);       // Time difference in hours
          
          // If the row was already updated within the <Update_period>, skip the row
          if ((time_diff < Update_period) && ((force_try == 0) || (current_rating != ""))) {
            if (debug_mode) {
              Logger.log("Updated recently. Skipping " + game_name);
            }
            continue;
          }
        }
        
        
        try {
          // Search query for games matching game_name
          var search_results = ItchIo_search(game_name);    // Returns: [[game_title, game_link]]
          query_count++;
          
          if (query_count > max_queries) {
            Logger.log("Exceeded <max_queries>. Halting run.");
            
            return null;
          }
          
          if ((search_results == null) || (search_results.length < 1)) {
            Logger.log("Search couldn't find Itch.io entries for " + game_name + "\n");
            
            // Set the update time and skip to the next game row
            range.getCell(rnum + 1, col_Itchio_UpdateTime + 1).setValue(new Date());
            continue;
          }
          
          if (debug_mode) {
            Logger.log("Found entries for " + game_name + ": " + search_results);
          }
          
          var rating       = 0;
          var reviewCount  = 0;
          
          // If matching games are found, get the rating and review_count
          var game_link = search_results[1];
          
          // Query for game data
          var scores = ItchIo_game(game_name, game_link);
          // returns [rating, reviewCount];
          rating = scores[0];
          reviewCount = scores[1];
          
          if (debug_mode || info_mode) {
            Logger.log("Score: " + scores);
          }
          query_count++;
          
          if (scores == null) {
            Logger.log("Couldn't find game data for: " + game_name);
          }
          
          // Update ratings/reviews in spreadsheet if not 0
          if ((rating != 0) && (reviewCount != 0)) {
            range.getCell(rnum + 1, col_Itchio_Rating + 1).setValue(rating);
            range.getCell(rnum + 1, col_Itchio_ReviewCount + 1).setValue(reviewCount);
          }
          
          // Update time
          range.getCell(rnum + 1, col_Itchio_UpdateTime + 1).setValue(new Date());
        }
        catch (e) {
          var msg = function_name + " - Failed to get data for " + game_name + " - Error: " + e;
          Logger.log(msg);
          Browser.msgBox(msg);
          
          return 0;
        }
      }
      
      // Refresh spreadsheet after going through each row
      SpreadsheetApp.flush();
    }
  }
  catch(e) {
    Logger.log(e);
    Browser.msgBox(e);
    
    return 0;
  }
  
  // Print runtime
  var function_Timer2 = Date.now(); // Stop timer
  var timer_diff = parseInt(Math.round((function_Timer2-function_Timer1)/100))/10; // Time in seconds, rounded to nearest 10th.
  
  if (info_mode || debug_mode) {
    Logger.log("Ending " + function_name + ". Runtime = " + timer_diff + "s");
  }
}

// The forced version
function update_ItchIo_Scores_force() {
  update_ItchIo_Scores(1);
}


//////////////////////
//
// ItchIo_search()
// This looks up Itch.io and returns a 1D array of matching [game_title, game_link] when searching for <game_title_argument>
// Returns <null> if no games found
//
//////////////////////
function ItchIo_search(game_title_argument) {
  var function_name = "ItchIo_search()";
  var url_query = URL_ItchIO_Search_prefix + game_title_argument;
  
  var game_search_items = [];    // 2D array of [[game_title, game_link]]
  
  var function_Timer1 = Date.now();
  if (debug_mode || info_mode) {
    Logger.log("");
    Logger.log("Starting " + function_name + " for " + game_title_argument);
    Logger.log(url_query);
  }
  
  // Fetch Itch.io search page
  // Get page contents
  try {
    var tries = 0;
    do {
      var response = UrlFetchApp.fetch(url_query);
      tries++;
      
      var responseCode = response.getResponseCode();
      if (responseCode != 200) {
        Logger.log("HTML status code for " + game + ": " + responseCode);
        
        // If exceeded max_fetch_attempts, quit
        if (tries > max_fetch_attempts) {
          return null;
        }
      }
      else {
        var html = response.getContentText();
      }
    } while(responseCode != 200);
  }
  catch(e) {
    let msg = function_name + " - couldn't fetch Itch.io search html for " + game_title_argument + ": " + e;
    Logger.log(msg);
    Browser.msgBox(msg);
    
    return null;
  }
  
  // Parse MC search page
  try {
    var game_blob = html.match(/(?<=<a class=\"title game_link\" ).+?<\/a>/gmi);
    // Result should be an array of: "href="https://rolla-mable.itch.io/rollamarble" data-label="game:349539:title" data-action="game_grid">RollaMarble</a>"
    
    if ((game_blob == null) || (game_blob.length==0)) {
      if (debug_mode) {
        Logger.log("No search results for: " + url_query);
      }
      return null;
    }
        
    var game_title = "";
    var game_link = "";
    
    // Find title, link for each search item
    game_blob.forEach(function(item) {
      
      // Skip if item is already found
      if (game_search_items.length > 0) {
        return 1;
      }
      
      var item = item.replace(/\s+/gmsi,' ');   // Remove consecutive whitespaces
      var game_title = item.match(/(?<=>).+?(?=<\/a>)/i);
      
      // Get game title
      if (game_title != null) {
        game_title = game_title[0];
        game_title = game_title.replace(/&[\w\d#]+;/ig,'').replace(/\+/ig, '');   // Some games have weird HTML encoded text, e.g. "&trade;", "&#039;" that need to be removed
        
        // Compare game_title to game_title_argument. Make sure they match
        // Otherwise, skip to the next seach item
        if (game_title_argument.replace(/[^\w\d]+/ig,'').toLowerCase() != game_title.replace(/[^\w\d]+/ig,'').toLowerCase()) {
          if (debug_mode) {
            Logger.log("Title doesn't match. Ignoring '" + game_title + "'");
          }
          return null;
        }
        else {
          var game_link = item.match(/(?<=href=\").+?(?=\")/i);
          
          // Get game link
          if (game_link != null) {
            game_link = game_link[0];
            
            game_search_items = [game_title, game_link];
            Logger.log("Found matching game: " + game_search_items)
            
            return "Found";
          }
          else {
            Logger.log("Failed to find game link for " + game_title_argument);
          }
        }
      }
      else {
        Logger.log("Failed to find game title for " + game_title_argument);
      }
      
    });
  }
  catch(e) {
    let msg = function_name + " - couldn't parse Itch.io search html for " + game_title_argument + ": " + e;
    Logger.log(msg);
    Browser.msgBox(msg);
    
    return null;
  }
  
  // Print runtime
  var function_Timer2 = Date.now(); // Stop timer
  var timer_diff = parseInt(Math.round((function_Timer2-function_Timer1)/100))/10; // Time in seconds, rounded to nearest 10th.
  Logger.log("Ending " + function_name + " for " + game_title_argument + ". Runtime = " + timer_diff + "s");
    
  if ((game_search_items == null) || (game_search_items.length == 0)) {
    return null;
  }
    
  return game_search_items;
}


//////////////////////
//
// ItchIo_game()
// This looks up MC and returns a 1D array of [rating, review_count] when looking up <game_link>
// Returns <null> if game, rating, or review_count are not found
//
//////////////////////
function ItchIo_game(game_name, game_link) {
  
  var function_name = "ItchIo_game()";
  var url_query = game_link;
  
  var function_Timer1 = Date.now();
  if (debug_mode) {
    Logger.log("");
    Logger.log("Starting " + function_name + " for " + game_name);
  }
  
  // Get page contents
  try {
    var tries = 0;
    do {
      var response = UrlFetchApp.fetch(url_query);
      tries++;
      
      var responseCode = response.getResponseCode();
      if (responseCode != 200) {
        Logger.log("HTML status code for " + game + ": " + responseCode);
        
        // If exceeded max_fetch_attempts, quit
        if (tries > max_fetch_attempts) {
          return null;
        }
      }
      else {
        var html = response.getContentText().replace(/\s+/gmsi,' ');
      }
    } while(responseCode != 200);
  }
  catch(e) {
    let msg = function_name + " - couldn't fetch Itch.io data for " + game_name + ": " + e;
    Logger.log(msg);
    Browser.msgBox(msg);
    
    return null;
  }
  
  // Parse HTML for ratings
  /* "aggregateRating":{"@type":"AggregateRating","ratingCount":25,"ratingValue":"4.4"},
  */
  try {
    
    var ratingCount = 0;
    var ratingValue = 0;
    
    var game_rating_blob = html.match(/(?<=\"AggregateRating\",)\"ratingCount\":\d+?,\"ratingValue\":\".+?\"},/i);
    
    if (game_rating_blob != null) {
    
      // Get the ratingCount
      var ratingCount = game_rating_blob[0].match(/(?<=\"ratingCount\":)\d+?(?=,)/i);
      if (ratingCount != null) {
        ratingCount = ratingCount[0];
      }
      
      // Get the ratingValue
      var ratingValue = game_rating_blob[0].match(/(?<=ratingValue":\")\d\.\d(?=\"})/i);
      if (ratingValue != null) {
        ratingValue = ratingValue[0];
      }
      
      if (debug_mode) {
        Logger.log("Rating Count: " + ratingCount);
        Logger.log("Rating Value: " + ratingValue);
      }
    }
  }
  catch(e) {
    let msg = function_name + " - Unable to parse Itch.io app page for " + game_name + ": " + e;
    Logger.log(msg);
    Browser.msgBox(msg);
    
    return null;
  }
  
  // Print runtime
  var function_Timer2 = Date.now(); // Stop timer
  var timer_diff = parseInt(Math.round((function_Timer2-function_Timer1)/100))/10; // Time in seconds, rounded to nearest 10th.
  if (debug_mode) {
    Logger.log("Ending " + function_name + " for " + game_name + ". Runtime = " + timer_diff + "s");
  }
  
  return [parseFloat(ratingValue), parseFloat(ratingCount).toFixed(0)];
}