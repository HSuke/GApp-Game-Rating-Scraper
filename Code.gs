/*
** Description: Script for getting SteamDB & Metacritic ratings
**
** Triggers: Manually-run
**
** Author:         Nathan Yang
** Last updated:   See Changelog below
** Created on:     2020-06-18
**
** Directions: In the spreadsheet, go to Menubar > Scripts Functions > Directions
**
** Changelog: 
**            2020-07-24 - Added sort by "Overall score"
**            2020-07-22 - console.log() updates
**            2020-06-28 - Added hyperlinks to the game pages
**            2020-06-28 - <max_fetch_attempts> set to 3. Fetches now try 3 times before failing
**            2020-06-24 - Various fixes - Initial release
**            2020-06-23 - Finished Metacritic.gs functions
**            2020-06-20 - Finished SteamDB.gs functions
**            2020-06-18 - Initial creation
**
** TO-DO:     Replace include_date_hyperlinks for games. It doesn't work.
**
*/

////////// GLOBAL VARIABLES - Start //////////

const FileID_This_Sheet           = "1kyN5MDX0oRiktGBgX4mGeYH2kq0vR0oD67E2_qTHmrs";
var Sheet_Raw_Data                = "Itch.io MVs";

var URL_SteamDB_Search        = "https://steamdb.info/search/?a=app&q="         // e.g. https://steamdb.info/search/?a=app&q=subnautica%20below%20
var URL_SteamDB_App           = "https://steamdb.info/app/"                     // e.g. https://steamdb.info/app/848450/

var URL_MC_domain             = "https://www.metacritic.com"
var URL_MC_Search_prefix      = "https://www.metacritic.com/search/game/"       // e.g. https://www.metacritic.com/search/game/hollow%20knight/results
var URL_MC_Search_suffix      = "/results"

var URL_ItchIO_Search_prefix  = "https://itch.io/search?q="

var SteamDB_game_type         = "Game";   // Only match SteamDB entries of this type.
var Update_period             = 96;       // Minimum number of hours before allow a row to update. We don't want to overload the servers and get blocked.
var max_queries               = 20        // Don't query more than this number of results from any external website per run
var max_fetch_attempts        = 3;        // Maximum number of tries before failing
var include_score_hyperlinks  = 0;        // Boolean for whether hyperlinks to the game pages will added to each score cell
var include_date_hyperlinks   = 0;        // Boolean for whether hyperlinks to the game pages will added to each timestamp cell

var info_mode                 = 0;        // Debug mode produces some Logger logs (slightly slower)
var debug_mode                = 1;        // Debug mode produces even Logger more logs (even slower)

// Column headers in <Sheet_Raw_Data>
var Header_Game_Title           = "Game Title"
var Header_Overall_Score        = "Overall score"
var Header_MC_UserS_Combined    = "MC User score (combined)"
var Header_MC_CriticS_Combined  = "MC Critic score (combined)"
var Header_MC_UserS             = "MC User scores (by platform)"
var Header_MC_CriticS           = "MC Critic scores (by platform)"
var Header_MC_Platforms         = "MC Platforms"
var Header_MC_UpdateTime        = "MC Last Checked"

var Header_SteamDB_Rating       = "SteamDB Rating"
var Header_SteamDB_ReviewCount  = "SteamDB Review Count"
var Header_SteamDB_CurrentPrice = "Current Steam Price"
var Header_SteamDB_LowestPrice  = "Lowest Steam Price"
var Header_SteamDB_UpdateTime   = "SteamDB Last Checked"

var Header_Itchio_Rating        = "Itch.io Rating";
var Header_Itchio_ReviewCount   = "Itch.io Review Count";
var Header_Itchio_UpdateTime    = "Itch.io Last Checked";

////////// GLOBAL VARIABLES - End //////////

// Update the "MV Data" page
function update_MVData_Page() {
  Sheet_Raw_Data = "MV Data";
  
  // Run 4 times to attempt to get through the list
  for (var i=0; i<4; i++) {
    update_MC_Scores();
    update_SteamDB_Scores();
    update_MC_Scores();
  }
}

// Update the "Itch.io MVs" page
function update_ItchiIo_Page() {
  Sheet_Raw_Data = "Itch.io MVs";
  
  // Run 3 times to attempt to get through the list
  for (var i=0; i<3; i++) {
    update_MC_Scores();
    update_SteamDB_Scores();
    update_MC_Scores();
    update_ItchIo_Scores();
  }
}

// Update the "Steam Sale MVs" page
function update_SteamSaleMVs_Page() {
  Sheet_Raw_Data = "Steam Sale MVs";
  
  // Run 3 times to attempt to get through the list
  for (var i=0; i<3; i++) {
    update_MC_Scores(0);
    update_SteamDB_Scores(0, 1);
    update_MC_Scores(0);
  }
}

// Update the "Itch.io Toma" page
function update_ItchiIo_Toma_Page() {
  Sheet_Raw_Data = "Itch.io Toma";
  
  // Run 3 times to attempt to get through the list
  for (var i=0; i<4; i++) {
    update_MC_Scores();
    update_SteamDB_Scores();
    update_MC_Scores();
    update_ItchIo_Scores();
  }
}

/*
Useful Links:

2 news items for Subnautica: https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=848450&count=1
https://store.steampowered.com/appreviews/848450
https://steamdb.info/app/438310/

https://www.reddit.com/r/itchioJusticeBundle/comments/h832x0/hey_guys_i_took_all_the_games_from_the_racial/

*/