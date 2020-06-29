# GApp-Game-Rating-Scraper
Built for Google App Script (javascript). It scrapes Metacritic, SteamDB, and Itchi.io

Instructions:
- Create a Google Sheet
- Create an app script for the Google Sheet and add each of the \*.gs files
- Create a blank sheet
- In "Code.gs", edit the Global Variables
  - Set <FileID_This_Sheet> to be the ID of the spreadsheet
  - Set <Sheet_Raw_Data> to be the name of the sheet containing the data
  - Add all Column headers in <Sheet_Raw_Data> to match all the Header variables listed in "Code.gs".
  - Tweak the global variables to your liking. The websites may temporarily block you if you make too many requests at a time.

Run one or more of the following functions to update the <Sheet_Raw_Data> sheet:
- update_SteamDB_Scores()
- update_MC_Scores()
- update_ItchIo_Scores()

Examples of sample functions are:
- update_MVData_Page()
- update_ItchiIo_Page()
- update_SteamSaleMVs_Page()
