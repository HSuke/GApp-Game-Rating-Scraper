/*

Test.gs

These functions for debugging will test 1 game at a time and output the results to via Logger.log()
Set <game_name> to whichever game you wish to look up

Test_SteamDB()
Test_MC()
Test_ItchIo()

*/

/*
Tests looking up SteamDB scores for <game_name>
*/
function Test_SteamDB() {
  
  var game_name = "Emuurom";
  
  // Turn on info & debug logs
  info_mode = 1;
  debug_mode = 1;
  
  var game_list = steamDB_search(game_name);
  
  Logger.log("game_list returned: " + game_list);
  
  if (game_list != null) {
    game_list.forEach(function(game) {
      Logger.log(steamDB_game(game[0]));
    });
  }
  else {
    Logger.log("No game found");
  }
}

/*
Tests looking up SteamDB scores for <game_name>, Sale version
*/
function Test_SteamDB_sale() {
  
  var game_name = "Bone Appetit";
  
  // Turn on info & debug logs
  info_mode = 1;
  debug_mode = 1;
  
  var game_list = steamDB_search(game_name);
  
  Logger.log("game_list returned: " + game_list);
  
  if (game_list != null) {
    game_list.forEach(function(game) {
      Logger.log(steamDB_game(game[0], 1));
    });
  }
  else {
    Logger.log("No game found");
  }
}

/*
Tests looking up MC scores for <game_name>
*/
function Test_MC() {
  
  var game_name = "Forma.8";
  
  // Turn on info & debug logs
  info_mode = 1;
  debug_mode = 1;
  
  var game_results = MC_search(game_name);    // [[game_title, game_platform, game_link, game_year, "CScore", "UScore"]]
  
  var all_platforms      = [];
  var total_cscore       = 0;
  var total_cscore_count = 0;
  var total_uscore       = 0;
  var total_uscore_count = 0;
  
  var cscore_str = [];
  var uscore_str = [];
  
  game_results.forEach(function(item) {
    
    var scores = MC_game(item[0]+' [' + item[1]+']', item[2]);
    // returns [cscore, uscore, cscore_count, uscore_count]
    
    if (debug_mode || info_mode) {
      Logger.log(item);
      Logger.log(scores);
    }
    
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
    
  });
  
  var all_scores = [(total_cscore/total_cscore_count).toFixed(1), total_cscore_count.toFixed(0), (total_uscore/total_uscore_count).toFixed(1), total_uscore_count.toFixed(0)];
  cscore_str = cscore_str.join(', ');
  uscore_str = uscore_str.join(', ');
  
  if (debug_mode || info_mode) {
    Logger.log("");
    Logger.log("Critic scores: " + cscore_str);
    Logger.log("User scores: " + uscore_str);
    Logger.log("Combined scores for " + game_name + ":");
    Logger.log(all_scores);
    Logger.log('[' + all_platforms.join(', ') + ']');
  }
  
  //"Hollow Knight"
  //"Yoku's Island Express"
  //"Dark Souls III"
  //"GUACAMELEE! 2"
}


// Tests looking up Itch.io scores for <game_name>
function Test_ItchIo() {
  var game_name = "Minit";
  
  // Turn on info & debug logs
  info_mode = 1;
  debug_mode = 1;
  
  var search_results = ItchIo_search(game_name);
  
  if (debug_mode) {
    Logger.log(search_results);
  }
  
  if (search_results != null) {
    var game_link = search_results[1];
    
    var rating_results = ItchIo_game(game_name, game_link);
    
    Logger.log(rating_results);
  }
  
  
}
