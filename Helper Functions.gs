////////////////////////////
// onOpen() menu

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  // Or DocumentApp or FormApp.
  ui.createMenu('Script Menu')
  .addItem('Update MV Data',         'update_MVData_Page')
  .addItem('Update Itch.io Data',    'update_ItchiIo_Page')
  .addItem('Update Itch.io Toma Data',      'update_ItchiIo_Toma_Page')
  .addSeparator()
  .addItem('Sort by Overall Score',      'sortBy_Overall_Score')
  .addSeparator()
  .addSubMenu(ui.createMenu('Scrape entries')
              .addItem('Scrape SteamDB',     'update_SteamDB_Scores')
              .addItem('Scrape Metacritic',  'update_MC_Scores')
              .addItem('Scrape Itch.io',     'update_ItchIo_Scores')
             )
  .addSubMenu(ui.createMenu('Scrape entries (force)')
              .addItem('Scrape SteamDB (force)',    'update_SteamDB_Scores_force')
              .addItem('Scrape Metacritic (force)', 'update_MC_Scores_force')
              .addItem('Scrape Itch.io (force)',    'update_ItchIo_Scores_force')
             )
  .addToUi();
}

////////////////////////////



function sortBy_Overall_Score(sheet_name) {
  
  var function_name = "sortBy_Overall_Score()";

  // Start timer
  var function_Timer1 = Date.now();
  if (debug_mode || info_mode) {
    Logger.log("Starting " + function_name);
  }
  
  // Open the sheet
  try {
    // Use active sheet if <sheet_name> parameter isn't provided
    if (typeof(sheet_name) == "undefined") {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      if (debug_mode) {
        Logger.log("Using active sheet: '" + sheet.getName() + "'");
      }
    }
    else {
      var sheet = SpreadsheetApp.openById(FileID_This_Sheet).getSheetByName(sheet_name);
      if (debug_mode) {
        Logger.log("Using parameter sheet: '" + sheet.getName() + "'");
      }
    }
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
    var col_Overall_Score         = header_row.indexOf(Header_Overall_Score);
    
    // Log header columns. Missing headers will be -1
    var col_headers = [col_Overall_Score];
    if (debug_mode) {
      Logger.log(col_headers.join(' ') + "\n");
    }
    
    // Quit if any headers don't match or are missing
    col_headers.forEach(function(col_head, index) {
      if (col_head == -1) {
        throw(function_name + " - Couldn't find all column headers. Index " + index + " of col_headers is wrong. Check script logs that header variables match headers in sheet: \"" + sheet.getName() + "\".");
      }
    });
  }
  catch(e) {
    let err_msg = e;
    console.error(err_msg);
    SpreadsheetApp.getUi().showModelessDialog(HtmlService.createHtmlOutput(err_msg), "Script error");
    
    return 0;
  }
  
  // Get whole range minus header
  var range = sheet.getRange(2,1,sheet.getMaxRows()-1,sheet.getMaxColumns());
  
  var sortOrder = [
    {column: col_Overall_Score + 1, ascending: false},
  ];
  
  // Sort range
  range.sort(sortOrder);

}