/*
Metacritic.gs contains 3 functions:

update_MC_Scores()
  Reads the games in <Sheet_Raw_Data> and updates the SteamDB scores
  Calls MC_search()

MC_search(game_title)
  This looks up MC and returns an 2D array of [[game_title, game_platform, game_link, game_year, "CScore", "UScore"]] when searching for <game>
  Returns <null> if no games found
  Calls MC_game()

MC_game(game_name+, game_link)
  This looks up MC and returns a 1D array of [cscore, uscore, cscore_count, uscore_count] when looking up <game_link>
  Returns <null> if game, ratings, or review_count are not found

*/

//////////////////////
//
// Reads the games in <Sheet_Raw_Data> and updates the MC scores
// <force_try>: If 1: Will try to scrape data for any row without scores, regardless of timestamp
//              If 0: Will only scrape data for any row without a recent timestamp
//
//////////////////////
function update_MC_Scores(force_try) {
  var function_name = "update_MC_Scores()";
  
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
    var col_MC_UserS_Combined     = header_row.indexOf(Header_MC_UserS_Combined);
    var col_MC_CriticS_Combined   = header_row.indexOf(Header_MC_CriticS_Combined);
    var col_MC_UserS              = header_row.indexOf(Header_MC_UserS);
    var col_MC_CriticS            = header_row.indexOf(Header_MC_CriticS);
    var col_MC_Platforms          = header_row.indexOf(Header_MC_Platforms);
    var col_MC_UpdateTime         = header_row.indexOf(Header_MC_UpdateTime);
    
    // Log header columns. Missing headers will be -1
    var col_headers = [col_Game_Title, col_MC_UserS_Combined, col_MC_CriticS_Combined, col_MC_UserS, col_MC_CriticS, col_MC_Platforms, col_MC_UpdateTime];
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
        var last_updated  = srow[col_MC_UpdateTime];
        var current_MCUS  = srow[col_MC_UserS_Combined];
        var current_MCCS  = srow[col_MC_CriticS_Combined];
        
        if ((last_updated != null) && (last_updated != "")) {
          var time_diff = (function_Timer1 - last_updated)/(1000 * 3600);       // Time difference in hours
          
          // If the row was already updated within the <Update_period>, skip the row
          if ((time_diff < Update_period) && ((force_try == 0) || ((current_MCUS != "") && (current_MCCS != "")))) {
            if (debug_mode) {
              Logger.log("Updated recently. Skipping " + game_name);
            }
            continue;
          }
        }
        
        
        try {
          // Search query for games matching game_name
          var game_list = MC_search(game_name);    // Returns: [[game_title, game_platform, game_link, game_year, "CScore", "UScore"]]
          query_count++;
          
          if (query_count > max_queries) {
            Logger.log("Exceeded <max_queries>. Halting run.");
            
            return null;
          }
          
          if ((game_list == null) || (game_list.length < 1)) {
            Logger.log("Search couldn't find MC entries for " + game_name + "\n");
            
            // Set the update time and skip to the next game row
            range.getCell(rnum + 1, col_MC_UpdateTime + 1).setValue(new Date());
            continue;
          }
          
          if (debug_mode) {
            Logger.log("Found entries for " + game_name + ": " + game_list);
          }
          
          var all_platforms      = [];
          var total_cscore       = 0;
          var total_cscore_count = 0;
          var total_uscore       = 0;
          var total_uscore_count = 0;
          
          var cscore_str = [];
          var uscore_str = [];
          
          // If matching games are found, get the rating and review_count
          game_list.forEach(function(item) {
            
            // Query for game data
            var scores = MC_game(item[0]+' [' + item[1]+']', item[2]);
            // returns [cscore, uscore, cscore_count, uscore_count]
            
            if (debug_mode || info_mode) {
              Logger.log(item);
              Logger.log(scores);
            }
            query_count++;
            
            if (scores == null) {
              Logger.log("Couldn't find game data for: " + game);
            }
            else {
              // Calculate critic scores
              if ((scores[0] != 0) && (scores[2] != 0)) {
                total_cscore += scores[0]*scores[2];
                total_cscore_count += scores[2];
                
                // Example: [Switch] 87.3 x32
                cscore_str.push('[' + item[1] + '] ' + scores[0].toFixed(1) + ' x' + scores[2].toFixed(0));
              }
              
              // Calculate user scores
              if ((scores[1] != 0) && (scores[3] != 0)) {
                total_uscore += scores[1]*scores[3];
                total_uscore_count += scores[3];
                
                // Example: [PC] 76.9 x53
                uscore_str.push('[' + item[1] + '] ' + scores[1].toFixed(1) + ' x' + scores[3].toFixed(0));
                
                // Add to platform list string
                all_platforms.push(item[1]);
              }
            }
            
            // Logger.log("Game '" + game_name + "' has " + game_review_count + " reviews averaging a score of " + game_rating + "\n");
            
          });
          
          var all_scores = [(total_cscore/total_cscore_count).toFixed(1), total_cscore_count.toFixed(0), (total_uscore/total_uscore_count).toFixed(1), total_uscore_count.toFixed(0)];
          cscore_str = cscore_str.join(', ');
          uscore_str = uscore_str.join(', ');
          
          if (all_platforms.length > 1) {
            uscore_str = "[Total] x" + total_uscore_count + "\n" + uscore_str;
            cscore_str = "[Total] x" + total_cscore_count + "\n" + cscore_str;
          }
          
          if (debug_mode) {
            Logger.log("");
            Logger.log("Critic scores: " + cscore_str);
            Logger.log("User scores: " + uscore_str);
            Logger.log("Combined scores for " + game_name + ":");
            Logger.log(all_scores);
            Logger.log('[' + all_platforms.join(', ') + ']');
          }
          
          // Update ratings/reviews in spreadsheet if not 0
          if ((total_uscore != 0) && (total_uscore_count != 0)) {
            range.getCell(rnum + 1, col_MC_UserS_Combined + 1).setValue((total_uscore/total_uscore_count).toFixed(1));
            range.getCell(rnum + 1, col_MC_UserS + 1).setValue(uscore_str);
            range.getCell(rnum + 1, col_MC_Platforms + 1).setValue(all_platforms.join(', '));
          }
          if ((total_cscore != 0) && (total_cscore_count != 0)) {
            range.getCell(rnum + 1, col_MC_CriticS_Combined + 1).setValue((total_cscore/total_cscore_count).toFixed(1));
            range.getCell(rnum + 1, col_MC_CriticS + 1).setValue(cscore_str);
          }
          
          // Update time
          range.getCell(rnum + 1, col_MC_UpdateTime + 1).setValue(new Date());
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
function update_MC_Scores_force() {
  update_MC_Scores(1);
}


//////////////////////
//
// MC_search()
// This looks up Metacritic and returns a 2D array of [[game_title, game_platform, game_link, game_year, "CScore", "UScore"]] when searching for <game_title_argument>
// The "CScore" and "UScore" are placeholders that will be overwritten later on
// Returns <null> if no games found
//
//////////////////////
function MC_search(game_title_argument) {
  var function_name = "MC_search()";
  var url_query = URL_MC_Search_prefix + game_title_argument + URL_MC_Search_suffix;
  
  var game_search_items = [];    // 2D array of [[game_title, game_platform, game_link, game_year, "", ""]]
  
  var function_Timer1 = Date.now();
  if (debug_mode || info_mode) {
    Logger.log("");
    Logger.log("Starting " + function_name + " for " + game_title_argument);
    Logger.log(url_query);
  }
  
  // Fetch MC search page
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
    let msg = function_name + " - couldn't fetch Metacritic search html for " + game_title_argument + ": " + e;
    Logger.log(msg);
    Browser.msgBox(msg);
    
    return null;
  }
  
  // Parse MC search page
  try {
    var parsed_li = html.match(/<span class=\"metascore_w.+?<\/li>/gmsi);
    
    if ((parsed_li == null) || (parsed_li.length==0)) {
      if (debug_mode) {
        Logger.log("No search results for: " + url_query);
      }
      return null;
    }
        
    var game_title = "";
    var game_platform = "";
    var game_link = "";
    var game_year = "";
    
    // Find title, link, and platform for each search item
    parsed_li.forEach(function(item) {
      
      var item = item.replace(/\s+/gmsi,' ');
      
      var game_item_blob = item.match(/<h3 class=\"product_title basic_stat\">.+?<\/h3>/msi);
      
      // Get game title & link
      if (game_item_blob != null) {
        
        var game_link_blob = game_item_blob[0].match(/<a href=.+(?=<\/a>)/si);
        if (game_link_blob != null) {
          
          game_title = game_link_blob[0].replace(/<a href=\".+\">\s+/i, '').replace(/\s+$/mi, '');
          
          // Compare game_title to game_title_argument. Make sure they match
          // Otherwise, skip to the next seach item
          if (game_title_argument.replace(/[^\w\d]+/ig,'').toLowerCase() != game_title.replace(/[^\w\d]+/ig,'').toLowerCase()) {
            if (debug_mode) {
              // Logger.log("Title doesn't match. Ignoring '" + game_title + "'");
            }
            return null;
          }
          
          game_link = game_link_blob[0].match(/(?<=<a href=\").+(?=\">\s)/i);
          if (game_link != null) {
            game_link = URL_MC_domain + game_link[0];
          }
          else {
            throw("Failed to get game link - blob: " + game_link_blob);
          }
        }
        else {
          throw("Failed to get game link blob - blob: " + game_item_blob);
        }
      }
      else {
        throw("Failed to get game blob - blob: " + item);
      }
      
      // Get game platform
      var platform_blob = item.match(/(?<=<span class="platform">).+(?=<\/span>)/i);
      if (platform_blob != null) {
        game_platform = platform_blob[0];
      }
      else {
        throw("Failed to get game platform - blob: " + item);
      }
      
      // Get game year
      var year_blob = item.match(/(?<=<\/span>\sGame, ).+?(?=\s<\/p>)/si);
      if (year_blob != null) {
        game_year = year_blob[0].replace(/\s+/ig,' ');
      }
      else {
        throw("Failed to get game year - blob: " + item);
      }
      
      // Ignore games that have a year status of "Canceled" or "TBA"
      if ((game_year != "Canceled") && (game_year != "TBA")) {
        var game_data = [game_title, game_platform, game_link, game_year, "CScore", "UScore"];
        
        // Push game data to game_search_items[]
        game_search_items.push(game_data);
        
        if (debug_mode) {
          Logger.log(game_data.join(", "));
        }
      }
      
    });
    
  }
  catch(e) {
    let msg = function_name + " - couldn't parse Metacritic search html for " + game_title_argument + ": " + e;
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
// MC_game()
// This looks up MC and returns a 1D array of [cscore, uscore, cscore_count, uscore_count] when looking up <game_link>
// Returns <null> if game, ratings, or review_count are not found
//
//////////////////////
function MC_game(game_name, game_link) {
  
  var function_name = "MC_game()";
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
    let msg = function_name + " - couldn't fetch Metacritic data for " + game_name + ": " + e;
    Logger.log(msg);
    Browser.msgBox(msg);
    
    return null;
  }
  
  // Parse HTML for ratings
  /* <div class="metascore_w xlarge game positive"><meta content="100"><span>87</span></div>
  // <meta itemprop="reviewCount" content="20153">
  */
  try {
    
    var cscore = 0;
    var uscore = 0;
    var cscore_count = 0;
    var uscore_count = 0;
    
    // Get the Critic score
    var game_cscore_blob = html.match(/<div class=\"metascore_w xlarge game.+?<\/div>/i);
        
    if (game_cscore_blob != null) {
      cscore = game_cscore_blob[0];
      cscore = cscore.match(/(?<=<span>)\d{1,3}(?=<\/span>)/i);
      if (cscore != null) {
        cscore = cscore[0];
      }
    }
    
    // Get the Critic score review count
    var game_cscore_count_blob = html.match(/(?<=<span > )\d+(?= <\/span> Critic Review)/i);
        
    if (game_cscore_count_blob != null) {
      cscore_count = game_cscore_count_blob[0];
    }
    
    if (debug_mode) {
      Logger.log("Critic score: " + cscore);
      Logger.log("Critic score count: " + cscore_count);
    }
    
    // Get the User score
    var game_uscore_blob = html.match(/<div class=\"metascore_w user large game.+?<\/div>/i);
        
    if (game_uscore_blob != null) {
      uscore = game_uscore_blob[0]; //">9.0</div>
      uscore = uscore.match(/(?<=\">)\d{1,3}\.\d{1,3}(?=<\/div>)/i);
      if (uscore != null) {
        uscore = uscore[0];
      }
    }
    
    // Get the User score review count
    var game_uscore_count_blob = html.match(/(?<=\">)\d+(?= Ratings?<\/a>)/i);
        
    if (game_uscore_count_blob != null) {
      uscore_count = game_uscore_count_blob[0];
    }
    
    if (debug_mode) {
      Logger.log("User score: " + uscore);
      Logger.log("User score count: " + uscore_count);
    }
    
  }
  catch(e) {
    let msg = function_name + " - Unable to parse Metacritic app page for " + game_name + ": " + e;
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
  
  return [parseFloat(cscore), parseFloat(uscore), parseInt(cscore_count), parseInt(uscore_count)];
}