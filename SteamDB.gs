/*
SteamDB.gs contains 3 functions:

update_SteamDB_Scores(force_try, check_price)
  Reads the games in <Sheet_Raw_Data> and updates the SteamDB scores
  If <force_try> is set to 1, it will disregard the timestamp and look up values as long as there's missing ratings data
  If <check_price> is set to 1, it will also update prices
  Calls steamDB_search()

steamDB_search(game_title)
  This looks up SteamDB and returns an 2D array of [[Game_ID, game_name]] when searching for <game>
  Returns <null> if no games found
  Calls steamDB_game()

steamDB_game(app_ID, check_price)
  This looks up SteamDB game info when looking up <app_ID>
  If <check_price> == 0, returns: [Game_ID, game_name, rating, review_count]
  If <check_price> == 1, returns: [Game_ID, game_name, rating, review_count, current_price, lowest_price]
  Returns <null> if game, ratings, or review_count are not found
*/



//////////////////////
//
// Reads the games in <Sheet_Raw_Data> and updates the SteamDB scores
// <force_try>: If 1: Will try to scrape data for any row without scores, regardless of timestamp
//              If 0: Will only scrape data for any row without a recent timestamp
// <check_price>: If 1: Will also check for current_price, lowest_price
//                If 0: Will not check for prices
//
//////////////////////
function update_SteamDB_Scores(force_try, check_price) {
  var function_name = "update_SteamDB_Scores()";
  
  // Optional argument: force_try; default: 0
  if (typeof(force_try) == "undefined") {
    force_try = 0;
  }
  
  // Optional argument: check_price; default: 0
  if (typeof(check_price) == "undefined") {
    check_price = 0;
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
    console.error(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
    return 0;
  }
  
  // Get Column Headers
  try {
    var header_row = sheet_data[0];
    if (debug_mode) {
      Logger.log(header_row);
    }
    
    // Get Column numbers
    var col_Game_Title                = header_row.indexOf(Header_Game_Title);
    var col_SteamDB_Rating            = header_row.indexOf(Header_SteamDB_Rating);
    var col_SteamDB_ReviewCount       = header_row.indexOf(Header_SteamDB_ReviewCount);
    var col_SteamDB_UpdateTime        = header_row.indexOf(Header_SteamDB_UpdateTime);
    
    var col_SteamDB_CurrentPrice      = header_row.indexOf(Header_SteamDB_CurrentPrice);
    var col_SteamDB_LowestPrice       = header_row.indexOf(Header_SteamDB_LowestPrice);
    
    // Log header columns. Missing headers will be -1
    var col_headers = [col_Game_Title, col_SteamDB_Rating, col_SteamDB_ReviewCount, col_SteamDB_UpdateTime];
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
    let err_msg = e;
    console.error(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
    return 0;
  }
  
  // Iterate through the sheets rows, query the game info, and then update them
  try {
    for (var rnum = 0; rnum < sheet_data.length; rnum++) {
      
      var srow          = sheet_data[rnum];
      var game_name     = srow[col_Game_Title];
      
      if ((game_name != "") && (game_name != Header_Game_Title)) {
        if (debug_mode) {
          Logger.log("Starting " + game_name);
        }
        
        // Get the last time the row was updated. If the row was already updated within the <Update_period>, skip the row
        var last_updated  = srow[col_SteamDB_UpdateTime];
        var current_score = srow[col_SteamDB_Rating];
        
        if ((last_updated != null) && (last_updated != "")) {
          var time_diff = (function_Timer1 - last_updated)/(1000 * 3600);       // Time difference in hours
          
          // If the row was already updated within the <Update_period>, skip the row
          if ((time_diff < Update_period) && ((force_try == 0) || (current_score != ""))) {
            if (debug_mode) {
              Logger.log("Updated recently. Skipping " + game_name);
            }
            continue;
          }
        }
        
        
        try {
          ////////////////
          // Search query for games matching game_name
          ////////////////
          var game_list = steamDB_search(game_name);
          query_count++;
          
          if (query_count > max_queries) {
            Logger.log("Exceeded <max_queries>. Halting run.");
            
            return null;
          }
          
          if ((game_list == null) || (game_list.length < 1)) {
            Logger.log("Search couldn't find SteamDB entries for " + game_name + "\n");
            
            // Set the update time and skip to the next game row
            range.getCell(rnum + 1, col_SteamDB_UpdateTime + 1).setValue(new Date());
            continue;
          }
          
          // Logger.log("Found entries for " + game_name + ": " + game_list);
          
          var game_id           = "";
          var url_link          = "";
          var game_rating       = "";
          var game_rating_hyperlink = "";
          var game_review_count = "";
          var current_price     = "";
          var lowest_price      = "";
          
          ////////////////
          // If matching games are found, get the rating and review_count
          ////////////////
          game_list.forEach(function(game) {
                        
            // Query for game data
            if (check_price == 0) {
              game_data = steamDB_game(game[0],0);
            }
            else if (check_price == 1) {
              game_data = steamDB_game(game[0],1);
            }
            // returns [[Game_ID, game_name, rating, review_count, current_price, lowest_price]]
            query_count++;
            
            if ((game_data == null) || (game_data.length < 1)) {
              Logger.log("Couldn't find game data for: " + game);
            }
            else {
              game_id    = game_data[0];
              url_link   = URL_SteamDB_App + game_id + '/';
              if (game_data[2] != "") {
                game_rating     = parseFloat(game_data[2]).toFixed(1);
                game_rating_hyperlink = "=HYPERLINK(\"" + url_link + "\"," + game_rating + ")"; 
              }
              else {
                game_rating = '';
              }
              game_review_count = game_data[3];
              current_price     = game_data[4];
              lowest_price      = game_data[5];
            }
            
            // Logger.log("Game '" + game_name + "' has " + game_review_count + " reviews averaging a score of " + game_rating + "\n");
            
          });
          
          // Update ratings/reviews in spreadsheet if not blank
          if (game_review_count != "") {
            if (game_rating != "") {
              if (include_score_hyperlinks) {
                range.getCell(rnum + 1, col_SteamDB_Rating + 1).setValue(game_rating_hyperlink);
              }
              else {
                range.getCell(rnum + 1, col_SteamDB_Rating + 1).setValue(game_rating);
              }
            }
            range.getCell(rnum + 1, col_SteamDB_ReviewCount + 1).setValue(game_review_count);
            
            if (check_price) {
              if (current_price != "") {
                range.getCell(rnum + 1, col_SteamDB_CurrentPrice + 1).setValue(current_price);
              }
              if (lowest_price != "") {
                range.getCell(rnum + 1, col_SteamDB_LowestPrice + 1).setValue(lowest_price);
              }
            }
          }
          
          // Update time
          if (include_date_hyperlinks) {
            var date_hyperlink = "=HYPERLINK(\"" + url_link + "\",\"" + (new Date().toDateString()) + "\")"; 
            range.getCell(rnum + 1, col_SteamDB_UpdateTime + 1).setValue(date_hyperlink);
          }
          else {
            range.getCell(rnum + 1, col_SteamDB_UpdateTime + 1).setValue(new Date());
          }
        }
        catch (e) {
          var err_msg = function_name + " - Failed to get data for " + game_name + " - Error: " + e;
          console.log(err_msg);
          SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
          
          return 0;
        }
      }
      
      // Refresh spreadsheet after going through each row
      SpreadsheetApp.flush();
    }
  }
  catch(e) {
    let err_msg = e;
    console.error(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
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
function update_SteamDB_Scores_force() {
  update_SteamDB_Scores(1);
}


//////////////////////
//
// steamDB_search()
// This looks up SteamDB and returns a 2D array of matching [[Game_ID, game_name]] when searching for <game>
// Returns <null> if no games found or if HTML status code is 503 <max_fetch_attempts> times
//
//////////////////////
function steamDB_search(game) {
  
  var function_name = "steamDB_search()";
  var url_query = URL_SteamDB_Search + game;
  
  var function_Timer1 = Date.now();
  if (debug_mode) {
    Logger.log("Starting " + function_name);
  }
  
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
    let err_msg = function_name + " - couldn't fetch SteamDB search html for " + game + ": " + e;
    console.log(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
    return null;
  }
  
  var SteamDB_games = [];
  
  // Parse the HTML
  try {
    html = html.match(/<tbody hidden>.+<\/tbody>/gmis);
    if (html != null) {
      var tbody_part = html[0];
      
      var tr_parts = tbody_part.match(/<tr class="app" .+?<\/tr>/gmis);
    }
    else {
      if (info_mode || debug_mode) {
        Logger.log("Failed to find tbody for " + game);
      }
      return null;
    }
    
    // Parse each <tbody> section
    if (tr_parts != null) {
      tr_parts.forEach(function(tr_game) {
        
        // Parse each <tr> section
        var td_parts = tr_game.match(/<td>.+?<\/td>/gmi);
        if ((td_parts != null) && (td_parts.length == 3)) {
          
          // First figure out the type. Ignore if the type isn't "Game"
          var game_type = td_parts[1].match(/(?<=td>).+(?=<\/td>)/i)[0];
          
          if (game_type == SteamDB_game_type) {
            // Parse each <td> section
            var game_id = td_parts[0].match(/(?<=\">)\d+(?=<\/a>)/i)[0];
            var game_name = td_parts[2].match(/(?<=td>).+(?=<\/td>)/i)[0];
            
            game_name = game_name.replace(/&[\w\d#]+;/ig,'').replace(/\+/ig, '');   // Some games have weird HTML encoded text, e.g. "&trade;", "&#039;" that need to be removed
            
            // game_name needs to match game
            // For the comparison ignore anything that's not a letter or number
            if (game_name.replace(/[^\w\d]+/ig,'').toLowerCase() == game.replace(/[^\w\d]+/ig,'').toLowerCase()) { 

              var game_data = [game_id, game_name];
              SteamDB_games.push(game_data);
            }
          }
          else {
            return;
          }
        }
        else {
          throw("td_parts doesn't have the number of parts");
        }
      });
    }
    else {
      throw("Failed to parse TR sections");
    }
  }
  catch(e) {
    let err_msg = function_name + " - Unable to parse SteamDB search page for " + game + ": " + e;
    console.log(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
    return null;
  }
  
  
  // Print runtime
  var function_Timer2 = Date.now(); // Stop timer
  var timer_diff = parseInt(Math.round((function_Timer2-function_Timer1)/100))/10; // Time in seconds, rounded to nearest 10th.
  
  if (info_mode || debug_mode) {
    Logger.log("Ending " + function_name + " for " + game + ". Runtime = " + timer_diff + "s");
  }
  
  // Successful return
  return SteamDB_games;
}

//////////////////////
//
// steamDB_game()
//   This looks up SteamDB game info when looking up <app_ID>
//   If <check_price> == 0, returns: [Game_ID, game_name, rating, review_count]
//   If <check_price> == 1, returns: [Game_ID, game_name, rating, review_count, current_price, lowest_price]
//   Returns <null> if game, ratings, or review_count are not found
//
//////////////////////
function steamDB_game(app_ID, check_price) {
  
  var function_name = "steamDB_game()";
  var url_query = URL_SteamDB_App + app_ID + '/';
  
  // Optional argument: check_price; default: 0
  if (typeof(check_price) == "undefined") {
    check_price = 0;
  }
  
  var function_Timer1 = Date.now();
  if (debug_mode) {
    Logger.log("Starting " + function_name);
    Logger.log("url_query: \"" + url_query + "\"");
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
        var html = response.getContentText().replace(/\s+/gmsi,' ');         // Grab HTML and also reduce extra whitespaces
      }
    } while(responseCode != 200);
  }
  catch(e) {
    let err_msg = function_name + " - couldn't fetch SteamDB data for app_ID " + app_ID + ": " + e;
    console.log(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
    return null;
  }
  
  // Parse HTML for ratings
  /* <meta itemprop="ratingValue" content="91.02">
  // <meta itemprop="reviewCount" content="20153">
  */
  try {
    
    // Scrape game_name
    var game_name = html.match(/(?<=itemprop="name">).+?(?=<\/td>)/gi);
        
    if (game_name != null) {
      game_name = game_name[0];
      game_name = game_name.replace(/&[\w\d#]+;/ig,'').replace(/\+/ig, '');   // Some games have weird HTML encoded text, e.g. "&trade;", "&#039;" that need to be removed
    }
    else {
      if (debug_mode) {
        Logger.log("Failed to find game_name");
      }
      
      return null;
    }
    
    // Scrape rating_value
    var rating_value = html.match(/(?<=itemprop="ratingValue" content=")[\d\.]+(?=">)/i);
    
    if (rating_value != null) {
      rating_value = rating_value[0];
    }
    else {
      
      // Don't do this. It's too inaccurate
      /*
      // For games with fewer reviews, SteamDB uses another layout. Try searching for this alternative layout
      rating_value = html.match(/(?<=header-thing-number header-thing-white\">❓ )\d+\.\d+(?=%<\/div>)/i);
      if (rating_value != null) {
        rating_value = rating_value[0];
      }
      else {
        rating_value = "";
        if (debug_mode) {
          Logger.log("Failed to find rating_value");
        }
        return null;
      }
      */
      
      rating_value = ""
    }
    
    // Scrape review_count
    var review_count = html.match(/(?<=itemprop="reviewCount" content=")[\d\.]+(?=">)/i);
    
    if (review_count != null) {
      var review_count = review_count[0];
    }
    else {
      
      // For games with fewer reviews, SteamDB uses another layout. Try searching for this alternative layout
      review_count = html.match(/(?<=% of the )\d+(?= user reviews for this game are positive)/i);
      if (review_count != null) {
        review_count = review_count[0];
      }
      else {
        review_count = "";
        if (debug_mode) {
          Logger.log("Failed to find review_count");
        }
        return null;
      }
    }
    
    if (check_price == 1) {
      // Scrape prices
      var price_blob = html.match(/\" data-cc=\"us\">.+?> U\.S\. Dollar.+?<\/tr>/i);
      
      if (price_blob != null) {
        price_blob = price_blob[0];
        
        if (debug_mode) {
          Logger.log(price_blob);
        }
        
        // Parse current price
        var current_price = price_blob.match(/(?<=U.S. Dollar\s<\/td>\s<td>)\$\d+\.\d{0,2}/i);
        
        if (current_price != null) {
          current_price = current_price[0];
        }
        else {
          current_price = "";
          if (debug_mode) {
            Logger.log("Failed to find current_price");
          }
          return null;
        }
        
        
        // Parse lowest price
        var lowest_price = price_blob.match(/td data-sort=\"\d+\">\$\d+\.\d{0,2}(?=<\/td>)/i);
        
        if (lowest_price != null) {
          lowest_price = lowest_price[0].replace(/td data-sort=\"\d+\">/i, '');
        }
        else {
          lowest_price = "";
          if (debug_mode) {
            Logger.log("Failed to find lowest_price");
          }
          return null;
        }
        
      }
    }
  }
  catch(e) {
    let err_msg = function_name + " - Unable to parse SteamDB app page for " + app_ID + ": " + e;
    console.log(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
    return null;
  }
  
  // Print runtime
  var function_Timer2 = Date.now(); // Stop timer
  var timer_diff = parseInt(Math.round((function_Timer2-function_Timer1)/100))/10; // Time in seconds, rounded to nearest 10th.
  if (info_mode || debug_mode) {
    Logger.log("Ending " + function_name + " for " + app_ID + ". Runtime = " + timer_diff + "s");
  }
  
  if (check_price == 1) {
    return [app_ID, game_name, rating_value, review_count, current_price, lowest_price];
  }
  else {
    return [app_ID, game_name, rating_value, review_count];
  }
}