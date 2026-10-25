// ==UserScript==
// @name        CalysteneHuntingSimulator2-dbg
// @namespace   https://alliancead2.pages-perso.free.fr/Scripts/
// @description Calystene Fourmizzz/Antzzz hunting simulator. Full user script.
// @include     http://test.fourmizzz.fr/Ressources.php
// @include     http://*.fourmizzz.fr/Ressources.php
// @include     https://*.fourmizzz.fr/Ressources.php
// @include     http://*.antzzz.org/Ressources.php
// @include     http://*.kr.ageofants.com/Ressources.php
// @version     2.00.35.03
// @author      Calystene
// @contributors  Taratata & Hraesvelg
// @require     https://code.jquery.com/jquery-2.2.4.js
// ==/UserScript==
// Fzzz : script d'origine intégré tel quel (greffon CHS2B compris), enveloppé dans
// fzzzLancerCHS2() pour ne s'exécuter que sur Ressources.php, quand le joueur choisit
// le lanceur « Budget de pertes ». Retouches marquées « Fzzz ».
function fzzzLancerCHS2() {
// Fzzz : dans un script d'extension, jQuery ignore async:false ; les lectures de
// pages qui en dépendent passent par une requête native synchrone équivalente.
function fzzzAjaxSync(o) {
  var x = new XMLHttpRequest();
  x.open("GET", o.url, false);
  x.send();
  if (x.status == 200 && o.success) o.success(x.responseText);
}


// ________________________________________________________________________________
// Get element by ID shortcut.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
function GEBI(p_csId) { return document.getElementById(p_csId); }

// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// GENERAL PURPOSE FUNCTIONS
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

var CHS2_Util = function() { };

// ________________________________________________________________________________
// Remove all empty line (including lines with only tab and/or spaces).
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Util.prototype.RemoveEmptyLines = function(p_cs) { return p_cs.replace(/\n[ \t\r\n]*\n/g, "\n"); };

// ________________________________________________________________________________
// remove all spaces in substring.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Util.prototype.RemoveAllSpaces = function(p_cs) { return p_cs.replace(/[ \t\r]+/g,""); };

// ________________________________________________________________________________
// remove all spaces at start and end of string.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Util.prototype.TrimSpaces = function(p_cs) { return p_cs.replace(/^\s\s*/, '').replace(/\s\s*$/, ''); };

// ________________________________________________________________________________
// Format a number.
// formatting a number as a string with 'p_nDecimalCount' decimal after coma
// and a thousand separator (empty string for none)
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Util.prototype.Format = function(p_nValue, p_nDecimalCount, p_csThousandSeparator)
{
  var nValue = Math.abs(p_nValue);
  var nIntegerPart = 0;
  var nDecimalPartAsInteger = 0;
  if (p_nDecimalCount == 0)
  {
    var nIntegerPart = Math.round(nValue);
  } else
  {
    nValue = Math.round(nValue * Math.pow(10, p_nDecimalCount)) / Math.pow(10, p_nDecimalCount);
    nIntegerPart = Math.floor(nValue);
    nDecimalPartAsInteger = Math.round(Math.pow(10, p_nDecimalCount) * (nValue - nIntegerPart));
    if (nDecimalPartAsInteger == Math.pow(10, p_nDecimalCount)) { nDecimalPartAsInteger = 0; }
  }

  var csFormatedString = nIntegerPart.toString();
  var nIntPartLength = csFormatedString.length;
  for (var i = 1; i < 20; i++)
  {
    if (nIntegerPart >= Math.pow(10, (3 * i)))
    {
      csFormatedString = csFormatedString.substring(0, nIntPartLength - (3 * i)) + p_csThousandSeparator + csFormatedString.substring(nIntPartLength - (3 * i));
    }
  }
  if (p_nDecimalCount > 0)
  {
    var csDecimalPartAsString = "";
    for (var j = 0; j < (p_nDecimalCount - nDecimalPartAsInteger.toString().length); j++) { csDecimalPartAsString += "0"; }
    nDecimalPartAsInteger = csDecimalPartAsString + nDecimalPartAsInteger.toString();
    csFormatedString = csFormatedString + "." + nDecimalPartAsInteger;
  }
  if (p_nValue < 0) {csFormatedString = "- " + csFormatedString;}
  return csFormatedString;
}

// ________________________________________________________________________________
// Fonction MyFixedLengthString
// Format a text with spaces to match given length.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Util.prototype.LengthFormat = function(p_csValue, p_nLength, p_bLeftSideFill, p_csFillingChar)
{
  var sRet = p_csValue;

  for (var i = 0; i < (p_nLength - p_csValue.length); i++)
  {
    if (p_bLeftSideFill) sRet = p_csFillingChar + sRet;
    else sRet += p_csFillingChar;
  }
  return sRet;
}

// ________________________________________________________________________________
// Fonction DateToString
// Formate une date en chaine conforme au masque fourni.
// Remplacements :
// %yyyy%     : année sur 4 chiffre.
// %yy%         : année sur 2 chiffres.
// %mmmm%  : mois sous forme texte intégrale (Septembre).
// %mmm%     : mois sous forme texte abrégée (Sept).
// %mm%        : mois sur 2 chiffres (09).
// %dddd%       : jour de la semaine sous forme texte intégrale (Lundi).
// %ddd%         : jours de la semaine sous forme texte abrégé (Lun).
// %dd%          : jour du mois sur deux chiffres (05).
// %d%            : jour du mois sur un ou deux chiffres (5 ou 12).
// %HH%         : heure sur 2 chiffres.
// %H%            : heure sur un ou deux chiffres.
// %MM%         : minutes sur deux chiffres.
// %SS%         : secondes sur deux chiffres.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Util.prototype.DateToString = function(a_date, as_format, aiLang)
{
  var tsMonths = new Array();
  // FRENCH
  tsMonths[0] = new Array("Janvier","Fevrier","Mars","Avril","Mai", "Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre");
  // ENGLISH
  tsMonths[1] = new Array("January","February","March","April","May", "June","July","August","September","October","November","December");
  // KOREAN
  tsMonths[2] = new Array("January","February","March","April","May", "June","July","August","September","October","November","December");

  var tsShortMonths = new Array();
  tsShortMonths[0] = new Array("Jan","Fev","Mars","Avr","Mai", "Juin","Juil","Aout","Sept","Oct","Nov","Dec");
  tsShortMonths[1] = new Array("Jan","Feb","Mar","Apr","May", "Jun","Jul","Aug","Sept","Oct","Nov","Dec");
  tsShortMonths[2] = new Array("Jan","Feb","Mar","Apr","May", "Jun","Jul","Aug","Sept","Oct","Nov","Dec");

  var tsDays = new Array();
  tsDays[0] = new Array("Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi");
  tsDays[1] = new Array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");
  tsDays[2] = new Array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");

  var tsShortDays = new Array();
  tsShortDays[0] = new Array("Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam");
  tsShortDays[1] = new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");
  tsShortDays[2] = new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");

  var sRet = as_format;
  // Années.
  sRet = sRet.replace(/(%yyyy%)/g, a_date.getFullYear());
  sRet = sRet.replace(/(%yy%)/g, String(a_date.getFullYear()).substr(2, 3));
  // Mois.
  sRet = sRet.replace(/(%mmmm%)/g, tsMonths[aiLang][a_date.getMonth()]);
  sRet = sRet.replace(/(%mmm%)/g, tsShortMonths[aiLang][a_date.getMonth()]);
  sRet = sRet.replace(/(%mm%)/g, (a_date.getMonth() < 9 ? "0" + (a_date.getMonth() + 1) : (a_date.getMonth() + 1)));
  // Jours.
  sRet = sRet.replace(/(%dddd%)/g, tsDays[aiLang][a_date.getDay()]);
  sRet = sRet.replace(/(%ddd%)/g, tsShortDays[aiLang][a_date.getDay()]);
  sRet = sRet.replace(/(%dd%)/g, (a_date.getDate() < 10 ? "0" + a_date.getDate() : a_date.getDate()));
  sRet = sRet.replace(/(%d%)/g, a_date.getDate());
  // Heures.
  sRet =sRet.replace(/(%HH%)/g, (a_date.getHours() < 10 ? "0" + a_date.getHours() : a_date.getHours()));
  sRet = sRet.replace(/(%H%)/g, a_date.getHours());
  // Minutes.
  sRet = sRet.replace(/(%MM%)/g, (a_date.getMinutes() < 10 ? "0" + a_date.getMinutes() : a_date.getMinutes()));
  // Secondes.
  sRet =sRet.replace(/(%SS%)/g, (a_date.getSeconds() < 10 ? "0" + a_date.getSeconds() : a_date.getSeconds()));

  return sRet;
}

// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// CalyArmyImport : Army parser utility class.
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

var CalyArmyImport = function()
{
  this.csUnitNamesDisplay = ["Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate", "Soldate", "Concierge", "Concierge d’élite", "Artilleuse", "Artilleuse d’élite", "Soldate d’élite", "Tank", "Tank d’élite", "Tueuse", "Tueuse d’élite"];

  this.csUnitNamesFilter = ["(J|j)eunes? (S|s)oldates? (N|n)aines?|JSN|YD|(Y|y)oung (d|D)war(f|ves)",
    "(S|s)oldates? (N|n)aines?|SN|(d|D)war(f|ves)",
    "(N|n)aines? d?’?(E|e|É|é)lites?|NE|(T|t)op (d|D)war(f|ves)",
    "(J|j)eunes? (S|s)oldates?|JS|YS|(Y|y)oung (S|s)oldiers?",
    "(S|s)oldates?|S|(S|s)oldiers?",
    "(C|c)oncierges?|C|D|(D|d)oorkeepers?",
    "(C|c)oncierges? d?’?(E|e|É|é)lites?|CE|TD|(T|t)op (d|D)oorkeepers?",
    "(A|a)rtilleuses?|A|FA|(F|f)ire (A|a)nts?",
    "(A|a)rtilleuses? d?’?(E|e|É|é)lites?|AE|TFA|(T|t)op (F|f)ire (A|a)nts?",
    "(S|s)oldates? d?’?(E|e|É|é)lites?|SE|TS|(T|t)op (S|s)oldiers?",
    "(T|t)anks?|Tk|TK",
    "(T|t)anks? d?’?(E|e|É|é)lites?|TkE|TT|(T|t)op (T|t)anks?",
    "(T|t)ueuses?|Tu|TU|K|(K|k)illers?",
    "(T|t)ueuses? d?’?(E|e|É|é)lites?|TuE|TK|(T|t)op (K|k)illers?"];

  this.nUnitNamesFilterOrder = [0, 2, 1, 3, 6, 5, 8, 6, 9, 4, 11, 10, 13, 12];

};

// ________________________________________________________________________________
// Get all game data (building, techno, army).
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CalyArmyImport.prototype.Split = function(p_RawTextData)
{
  var sRawTextData = p_RawTextData;
  sRawTextData = sRawTextData.replace(/Troupes en attaque/g, "Troupes en attaque\n");
  sRawTextData = sRawTextData.replace(/Troupes en défense/g, "Troupes en défense\n");
  sRawTextData = sRawTextData.replace(/Attacking troops/g, "Attacking troops\n");
  sRawTextData = sRawTextData.replace(/Defending troops/g, "Defending troops\n");
  // Split raw data input.
  return sRawTextData.split(/[\n,;]+/);
}

// ________________________________________________________________________________
// Get all game data (building, techno, army).
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CalyArmyImport.prototype.ParseData = function(p_RawTextData)
{
  var oUnits = new Array();
  oUnits["Names"] = new Array();
  oUnits["Count"] = new Array();

  var iData, iUnit, iCount;

  // Split raw data input.
  var oRawData = this.Split(p_RawTextData);

  // Initialize output.
  for (iUnit = 0; iUnit < 14; iUnit++)
  {
    oUnits["Names"][iUnit] = this.csUnitNamesDisplay[iUnit];
    oUnits["Count"][iUnit] = 0;
  }

  // Parse raw input to extract unit count.
  for (iData = 0; iData < oRawData.length; iData++)
  {
    for (iUnit = 0; iUnit < this.nUnitNamesFilterOrder.length; iUnit++)
    {
      if (new RegExp(this.csUnitNamesFilter[this.nUnitNamesFilterOrder[iUnit]], "g").test(oRawData[iData]))
      {
        iCount = 0;
        if (new RegExp("[0-9][0-9 ]*", "g").test(oRawData[iData]))
        {
          iCount = parseInt((new RegExp("[0-9][0-9 ]*", "g").exec(oRawData[iData]))[0].replace(/[ \t\r]+/g,""));
          oUnits["Count"][this.nUnitNamesFilterOrder[iUnit]] += iCount;
        }
        break;
      }
    }
  }

  return oUnits;
};

// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// END CalyArmyImport.
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// GAME AND PLAYER DATA.
// Mainly copied on Utils Hraesvelg's class.
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

var CHS2_GameData = function()
{
  // GAME DATA

	// Current url
	this.csURI  = location.pathname;
  // Current server language.
  this.csLang = "EN";
  if (new RegExp("(.*).fourmizzz.fr(.*)", "g").test(location.href))     this.csLang = "FR";
  if (new RegExp("(.*)kr.ageofants.com(.*)", "g").test(location.href))  this.csLang = "KR";
  // Is user connected ?
	this.bIsConnected   = false;
  // Units data.
	if (this.csLang == "FR")
  {
    this.csUnitNames = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate", "Soldate", "Concierge", "Concierge d’élite", "Artilleuse", "Artilleuse d’élite", "Soldate d’élite", "Tank", "Tank d’élite", "Tueuse", "Tueuse d’élite"];
    this.csUnitNamesDisplay = ["Ouvrière", "Jeune Soldate Naine", "Soldate Naine", "Naine d’Elite", "Jeune Soldate", "Soldate", "Concierge", "Concierge d’élite", "Artilleuse", "Artilleuse d’élite", "Soldate d’élite", "Tank", "Tank d’élite", "Tueuse", "Tueuse d’élite"];
	  this.csUnitNamesShortDisplay = ["Ouv.", "JSN", "SN", "NE", "JS", "S", "C", "CE", "A", "AE", "SE", "Tk", "TkE", "Tu", "TuE"];
  }
  else if (this.csLang == "KR")
  {
    this.csUnitNames = ["일개미", "젊은 난쟁이 개미", "난쟁이 개미", "엘리트 난쟁이", "젊은 병정 개미", "병정 개미", "문지기", "엘리트 문지기", "포수 개미", "엘리트 포수 개미", "엘리트 병정 개미", "전차", "엘리트 전차 개미", "닌자 개미", "엘리트 닌자 개미"];
    this.csUnitNamesDisplay = ["일개미", "젊은 난쟁이 개미", "난쟁이 개미", "엘리트 난쟁이", "젊은 병정 개미", "병정 개미", "문지기 ", "엘리트 문지기", "포수 개미", "엘리트 포수 개미", "엘리트 병정 개미", "전차", "엘리트 전차 개미", "닌자 개미", "엘리트 닌자 개미"];
    this.csUnitNamesShortDisplay = ["일개미", "젊은 난쟁이 개미", "난쟁이 개미", "엘리트 난쟁이", "젊은 병정 개미", "병정 개미", "문지기 ", "엘리트 문지기", "포수 개미", "엘리트 포수 개미", "엘리트 병정 개미", "전차", "엘리트 전차 개미", "닌자 개미", "엘리트 닌자 개미"];
  }
  else
  {
    this.csUnitNames = ["Workers", "Young dwarf", "Dwarf", "Top dwarf", "Young soldier", "Soldier", "Doorkeeper", "Top doorkeeper", "Fire ant", "Top fire ant", "Top soldier", "Tank", "Top tank", "Killer", "Top killer"];
    this.csUnitNamesDisplay = ["Workers", "Young dwarf", "Dwarf", "Top dwarf", "Young soldier", "Soldier", "Doorkeeper", "Top doorkeeper", "Fire ant", "Top fire ant", "Top Soldier", "Tank", "Top tank", "Killer", "Top killer"];
    this.csUnitNamesShortDisplay = ["Work.", "YD", "Dwarf", "T-D", "YS", "S", "Door", "T-Door", "FA", "T-FA", "T-S", "Tk", "T-Tk", "K", "T-K"];
  }

	this.nUnitsLayingTimes = [60, 300, 450, 570, 740, 1000, 1410, -1, 1440, 1520, 1450, 1860, -1, 2740, 2740];
	this.nUnitsFoodCosts   = [5, 16, 20, 26, 30, 36, 70, 100, 30, 34, 44, 100, 150, 80, 90];
	this.nUnitsBaseHP      = [-1, 8, 10, 13, 16, 20, 30, 40, 10, 12, 27, 35, 50, 50, 55];
	this.nUnitsBaseAtt     = [-1, 3, 5, 7, 10, 15, 1, 1, 30, 35, 24, 55, 80, 50, 55];
	this.nUnitsBaseDef     = [-1, 2, 4, 6, 9, 14, 25, 35, 15, 18, 23, 1, 1, 50, 55];
  // Building and techno data.
  if (this.csLang  == "FR")
  {
    this.csBuildingNames = ["Champignonnière", "Entrepôt de Nourriture", "Entrepôt de Matériaux", "Couveuse", "Solarium", "Laboratoire", "Salle d'analyse", "Salle de combat", "Caserne", "Dôme", "Loge Impériale", "Etable à pucerons", "Etable à cochenilles"];
    this.csTechnoNames   = ["Technique de ponte", "Bouclier Thoracique", "Armes", "Architecture", "Communication avec les animaux", "Vitesse de chasse", "Vitesse d'attaque", "Génétique", "Acide", "Poison"];
  }
  else if (this.csLang  == "KR")
  {
    this.csBuildingNames = ["버섯 재배 실", "식량 창고", "재료 창고", "부화실", "햇빛방", "실험실", "분석실", "전투 훈련실", "병영", "방", "여왕 개미의 방", "진딧물 축사", "연지 벌레 축사"];
    this.csTechnoNames   = ["산란 기술", "가슴 방패", "무기", "건설", "동물과의 커뮤니케이션", "사냥의 속도", "공격 속도", "유전", "개미산", "독"];
  }
  else
  {
    this.csBuildingNames = ["Mushroom Chamber", "Food Warehouse", "Material Warehouse", "Incubator", "Solarium", "Laboratory", "Analysis room", "Fighting room", "Barracks", "Dome", "Nest", "Aphid room", "Mealybug Room"];
    this.csTechnoNames   = ["Laying device", "Thorax Shield", "Weapons", "Architecture", "Communication with animals", "Hunting speed", "Attack speed", "Genetics", "Acid", "Poison"];
  }

  // USER DATA

	// User name.
	this.csUserName	        = "";
	// Has user Option+ ?
	this.bAsOptionPlus      = false;
  // User hunting field.
	this.nHF                = 0;
	// User unit count.
  this.nUserUnits         = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	// Building and techno levels.
	this.nBuildingLevels    = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	this.nTechnoLevels      = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  this.bIsBuildingUpdated = false;
  this.bIsTechnoUpdated   = false;

};

// ________________________________________________________________________________
// Get all game data (building, techno, army).
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_GameData.prototype.getGameData = function()
{
  // Test if launched from game or from Simulator only.
  if (new RegExp("(.*).antzzz.org|(.*).fourmizzz.fr|(.*).kr.ageofants.com", "g").test(location.host))
  {
    this.getPageData();
    this.getBuildings();
    this.getTechno();
    this.getArmy();
  }
};

// ________________________________________________________________________________
// Get data inside game page.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_GameData.prototype.getPageData = function()
{
  // Is user connected ?
	this.bIsConnected       = $(".boite_connexion_titre").text() != "Connexion" ? true : false;
	// User name.
	this.csUserName	        = $("#pseudo").text();
	// Has user Option+ ?
	this.bAsOptionPlus      = $("#boiteComptePlus").find("table").length ? true : false;
  // User hunting field.
	this.nHF                = parseInt($("#quantite_tdc").text());
	// User unit count.
  this.nUserUnits[0]      = parseInt($("#nb_ouvrieres").text());
};

// ________________________________________________________________________________
// Get building levels.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_GameData.prototype.getBuildings = function()
{
  fzzzAjaxSync({ // Fzzz : $.ajax synchrone ignoré dans l'extension
    url     : "/construction.php",
    async   : false,
    success : function(data)
    {
      var parsed = $("<div/>").append(data);
      parsed.find(".ligneAmelioration").each(function(i){oCHS2_data.nBuildingLevels[i] = parseInt($(this).find(".niveau_amelioration").text().split(" ")[1]);});
    }
  });
  this.bIsBuildingUpdated = true;
};

// ________________________________________________________________________________
// Get techno levels
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_GameData.prototype.getTechno = function()
{
  fzzzAjaxSync({ // Fzzz : $.ajax synchrone ignoré dans l'extension
    url     : "/laboratoire.php",
    async   : false,
    success : function(data)
    {
      var parsed = $("<div/>").append(data);
      parsed.find(".ligneAmelioration").each(function(i){oCHS2_data.nTechnoLevels[i] = parseInt($(this).find(".niveau_amelioration").text().split(" ")[1]);});
    }
  });
  this.bIsTechnoUpdated = true;
};

// ________________________________________________________________________________
// Get player army units.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_GameData.prototype.getArmy = function()
{
  for (var i = 1; i < oCHS2_data.csUnitNamesDisplay.length; i++)
  {
    oCHS2_data.nUserUnits[i] = 0;
  }

  fzzzAjaxSync({ // Fzzz : $.ajax synchrone ignoré dans l'extension
  url     : "/Armee.php",
  async   : false,
  success : function(data)
    {
      $(data).find(".simulateur tr[align='center']:lt(14)").each(function(){
        var label = oCHS2_util.TrimSpaces($(this).find(".pas_sur_telephone").text());
        if(label)
          $(this).find("td span").each(function(){
            oCHS2_data.nUserUnits[oCHS2_data.csUnitNames.indexOf(label)] += parseInt($(this).text().replace(/[^0-9]/g, ''));
          });
      });
    }
  });
};

// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// SIMU.
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

var CHS2_Simu = function()
{
  // Building and techno levels used for hunt simulation.
  this.usedTechno     = ["Weapon", "Incubator", "Shield", "Solarium", "HuntSpeed", "LayingDevice"];
  this.nUsedLevels    = new Array();

  // Unit numbers used for hunt simulation.
  this.nUserUsedUnits = [parseInt($("#nb_ouvrieres").text()), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  // Army total attack used for hunt simulation.
  this.nPlayerArmyBaseAtt = 0;
  this.nPlayerArmyAtt     = 0;

  // BaseHF and EndHF
  this.nBaseHF = oCHS2_data.nHF;
  this.nEndHF = oCHS2_data.nHF;

  // Hunts ratio and stats.
  this.nDefaultRatioIndex           = 9;
  this.dHuntsRatiosValues           = [1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10];
  this.dHuntsRatios10pcReplyChances = [0, 0, 0, 0.016, 0.093, 0.345, 0.577777778, 0.753, 0.837, 0.874, 0.937, 0.96, 0.989];
  this.csHuntsRatiosBGcolors        = ["#000000", "#000000", "#000000", "#000000", "#ff0000", "#ff0000", "#ff0000", "#FFAE00", "#FFAE00", "#31DE1B", "#31DE1B", "#31DE1B", "#31DE1B"];
  this.csHuntsRatiosColors          = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000", "#000000"];

	this.dHuntsRatiosMinLosses        = [0.103971824, 0.066805442, 0.036854146, 0.014477073, 0.010067247, 0.008361713, 0.00751662, 0.007060666, 0.006692853, 0.006402339, 0.006090569, 0.0057788, 0.005080623];
	this.dHuntsRatiosAvgLosses        = [0.14183641, 0.089382202, 0.065595625, 0.037509208, 0.024982573, 0.018532185, 0.014281932, 0.011725921, 0.010437083, 0.009834768, 0.009339662, 0.008844556, 0.008502895];
	this.dHuntsRatiosMaxLosses        = [0.33333334, 0.176739357, 0.113191158, 0.08245817, 0.051342954, 0.036955988, 0.03395735, 0.032083615, 0.026461955, 0.024588162, 0.021774264, 0.018960366, 0.017190797];

  // Computed labels and tips for Ratios.
  this.csHuntsRatiosLabels  = new Array();
  this.csHuntsRatioTips     = new Array();

  // Selected reference ratio index.
  this.nSelectedRefRatioIndex = 9;

  // Computed real ratio and ref ratio index.
  this.nRealRatio     = 8.0;
  this.nRefRatioIndex = 9;

  // Computed hunt count, amount, difficulty, losses.
  this.nHuntCount   = 0;
  this.nHuntAmount  = 0;
  this.nDifficulty  = 0;
  this.nLosses      = new Array();
  this.nFirstHuntToLaunch = 0;

  // Dispatching for each hunt : units, difficulty, losses.
  this.nEachHuntDispatchUnits = new Array();
  this.nEachHuntDifficulties  = new Array();
  this.nEachHuntLosses        = new Array();

  // Xp priority & losses security factor (send max losses x dLossesSecurityFactor *YD).
  this.nXpPriorities          = [13, 11, 8, 6, 5, 4, 2];
  this.nNoXpOrder             = [14, 12, 10, 9, 7, 3, 1];
  this.dLossesSecurityFactor  = 2.0;

  // SIMU GUI DATA

  // To know when ratio is changed by user or by simulator
  this.bRatioManualChange = false;

  // Other HF losses default values.
  this.nOtherHF = [0, 1000000, 5000000, 10000000, 15000000, 20000000, 30000000, 40000000, 50000000, 75000000, 100000000];

  // French and english GUI labels.
  this.csGuiLabels = new Array();

  this.csGuiLabels["ShowFR"] = "Afficher";
  this.csGuiLabels["HideFR"] = "Masquer";
  this.csGuiLabels["ShowKR"] = "Show";
  this.csGuiLabels["HideKR"] = "Hide";
  this.csGuiLabels["ShowEN"] = "Show";
  this.csGuiLabels["HideEN"] = "Hide";

  var tab = function(nNb) { var csRet = ""; for (var n = 0; n < nNb; n++) { csRet += "&nbsp;&nbsp;&nbsp;&nbsp;"; } return csRet; };

  // Revision History
  this.csGuiLabels["HistoryFR"] =
    "<b><u>Historique des versions</u> : </b><br/><ul>" +
    "<li><b>Historique global :</b> Simu Excel (2009-2012), version online v0.xx (2012), Intégré dans Outiiil par Hraesvelg (2012...) </li>" +
    "<li><b>v2.00 :</b> Sept-Oct 2014, développement de cette version « full script ». </li><ul>"+
      "<li><b>rev 2.00.20 :</b> Développement initial. Première beta version publiée. (3 Oct 2014)</li>" +
      "<li><b>rev 2.00.24 :</b> Amélioration affichage et lancement des chasses (lancement individuel, statut, pertes max pour un TdC donné) + affichage divers. (12 Oct 2014)</li>" +
      "<li><b>rev 2.00.25 :</b> Obligation de respect de l’ordre de lancement pour les lancements individuels. Le lancement global ne tient compte que des chasses restant à lancer. (21 Oct 2014)</li>" +
      "<li><b>rev 2.00.26 :</b> (Cet) historique des révisions. Affichage du bouton « Lancer tout ». (21 Oct 2014)</li>" +
      "<li><b>rev 2.00.27 :</b> Rechargement page lors du lancement individuel de la dernière chasse. Bouton d'annulation de toutes les chasses (seulement les chasses annulables !). Bouton de déverrouillage de la sécurité du lancement individuel. (21 Oct 2014)</li>" +
      "<li><b>rev 2.00.28 :</b> Correction bug des Tueuses oubliées. (24 Oct 2014)</li>" +
      "<li><b>rev 2.00.29 :</b> Correction bug répartition JSN. (07 Nov 2014)</li>" +
      "<li><b>rev 2.00.30 :</b> Noms des unités « élites » remises en anglais dans le jeu. (25 May 2015)</li>" +
      "<li><b>rev 2.00.31 :</b> Filtrage page jeu pour extension firefox + Premiers tests pour le serveur Coréen. (19 Aout 2015)</li>" +
      "<li><b>rev 2.00.32 :</b> Tests pour le serveur Coréen. (20 Aug 2015)</li>" +
      "<li><b>rev 2.00.33 :</b> Calcul du montant à chasser pour une date d'arrivée. <i>(beta version)</i> (09 Feb 2018)</li>" +
      "<li><b>rev 2.00.34 :</b> Import d'armée. <i>(beta version)</i> (15 March 2018)</li>" +
    "</ul></li></li>";
  this.csGuiLabels["HistoryKR"] =
    "<b><u>Revision history</u> : </b><br/><ul>" +
    "<li><b>Global simulator history :</b> Excel versions (2009-2012), Online v0.xx version (2012), Integrated in Outiiil by Hraesvelg (2012...) </li>" +
    "<li><b>v2.00 :</b> Sept-Oct 2014, this « full script » version development. </li><ul>" +
      "<li><b>rev 2.00.20 :</b> Initial developpment. First beta version released (3 Oct 2014).</li>" +
      "<li><b>rev 2.00.24 :</b> Upgrade hunts display and launch (single launch, status, max losses for given HF) + various display. (12 Oct 2014)</li>" +
      "<li><b>rev 2.00.25 :</b> Single launch with mandatory launch order. Full launch send only remaining hunts. (21 Oct 2014)</li>" +
      "<li><b>rev 2.00.26 :</b> (This) revision history. « Launch All » button display. (21 Oct 2014)</li>" +
      "<li><b>rev 2.00.27 :</b> Reload page when launching last hunt (even single launch). Add all hunts cancellation button (only cancellable hunts !). Unlock single launche security button.(21 Oct 2014)</li>" +
      "<li><b>rev 2.00.28 :</b> Forgotten Killers bug fix. (24 Oct 2014)</li>" +
      "<li><b>rev 2.00.29 :</b> YD dispatch bug fix. (07 Nov 2014)</li>" +
      "<li><b>rev 2.00.30 :</b> English Top unit name back from French to English. (25 May 2015)</li>" +
      "<li><b>rev 2.00.31 :</b> Filtering server page for Firefox extension + First Korean server tests. (19 Aug 2015)</li>" +
      "<li><b>rev 2.00.32 :</b> Korean server tests. (20 Aug 2015)</li>" +
      "<li><b>rev 2.00.33 :</b> Compute hunt amount for a given arrival date. <i>(beta version)</i> (09 Feb 2018)</li>" +
      "<li><b>rev 2.00.34 :</b> Import army. <i>(beta version)</i> (15 March 2018)</li>" +
    "</ul></li></li>";
  this.csGuiLabels["HistoryEN"] =
    "<b><u>Revision history</u> : </b><br/><ul>" +
    "<li><b>Global simulator history :</b> Excel versions (2009-2012), Online v0.xx version (2012), Integrated in Outiiil by Hraesvelg (2012...) </li>" +
    "<li><b>v2.00 :</b> Sept-Oct 2014, this « full script » version development. </li><ul>" +
      "<li><b>rev 2.00.20 :</b> Initial developpment. First beta version released (3 Oct 2014).</li>" +
      "<li><b>rev 2.00.24 :</b> Upgrade hunts display and launch (single launch, status, max losses for given HF) + various display. (12 Oct 2014)</li>" +
      "<li><b>rev 2.00.25 :</b> Single launch with mandatory launch order. Full launch send only remaining hunts. (21 Oct 2014)</li>" +
      "<li><b>rev 2.00.26 :</b> (This) revision history. « Launch All » button display. (21 Oct 2014)</li>" +
      "<li><b>rev 2.00.27 :</b> Reload page when launching last hunt (even single launch). Add all hunts cancellation button (only cancellable hunts !). Unlock single launche security button.(21 Oct 2014)</li>" +
      "<li><b>rev 2.00.28 :</b> Forgotten Killers bug fix. (24 Oct 2014)</li>" +
      "<li><b>rev 2.00.29 :</b> YD dispatch bug fix. (07 Nov 2014)</li>" +
      "<li><b>rev 2.00.30 :</b> English Top unit name back from French to English. (25 May 2015)</li>" +
      "<li><b>rev 2.00.31 :</b> Filtering server page for Firefox extension + First Korean server tests. (19 Aug 2015)</li>" +
      "<li><b>rev 2.00.32 :</b> Korean server tests. (20 Aug 2015)</li>" +
      "<li><b>rev 2.00.33 :</b> Compute hunt amount for a given arrival date. <i>(beta version)</i> (09 Feb 2018)</li>" +
      "<li><b>rev 2.00.34 :</b> Import army. <i>(beta version)</i> (15 March 2018)</li>" +
    "</ul></li></li>";

  // FRENCH LABELS.
  if (oCHS2_data.csLang == "FR")
  {
    this.csGuiLabels["Title"]                   = "Simulateur/Lanceur de chasse";
    this.csGuiLabels["HideSimulator"]           = this.csGuiLabels["HideFR"];
    // History
    this.csGuiLabels["ShowHistory"]             = this.csGuiLabels["ShowFR"] + " Historique versions";
    this.csGuiLabels["History"]                 = this.csGuiLabels["HistoryFR"];
    // Import
    this.csGuiLabels["ShowImport"]             = this.csGuiLabels["ShowFR"] + " Import";
    // User data.
    this.csGuiLabels["HideUserData"]            = this.csGuiLabels["HideFR"] + " données joueur";
    this.csGuiLabels["UserDataRetrieve"]        = "Récupérer";
    this.csGuiLabels["UserDataRetrieveTip"]     = "Récupérer/Rafraichir les données à partir des données du jeu pour le joueur courant.\n"
                                                  + " (Constructions, technos, armée et TdC.)";
    this.csGuiLabels["UserDataImport"]          = "Importer";
    this.csGuiLabels["UserDataMandatory"]       = "Données obligatoires";
    this.csGuiLabels["UserDataMandatoryTip"]    = "Données nécessaires pour les calculs du simulateur de chasse.";
    this.csGuiLabels["UserDataOptionnal"]       = "Données secondaires";
    this.csGuiLabels["UserDataOptionnalTip"]    = "Données optionnelles : permet uniquement d’indiquer le temps de ponte correspondant aux pertes.";
    this.csGuiLabels["UserDataArmy"]            = "Armée";
    this.csGuiLabels["UserDataArmyTip"]         = "Pensez à garder quelques millions de JSN si vous voulez flooder les autres chasseurs ;-)";
    this.csGuiLabels["UserDataArmyAttTip"]      = "Attaque AB de l’armée ci-dessus, avec bonus Armes saisi.";
    // Sim param.
    this.csGuiLabels["HideSimParam"]            = this.csGuiLabels["HideFR"] + " paramètres de chasse";
    this.csGuiLabels["SimParamLaunchHF"]        = "TdC au lancement";
    this.csGuiLabels["SimParamEndHF"]           = "TdC à l’arrivée";
    this.csGuiLabels["SimParamLaunchHFTip"]     = "TdC au moment du lancement, calcul de la durée de la chasse.\n"
                                                  + "(Ne pas modifier si vous lancez immédiatement, "
                                                  + "ne modifier que pour simuler sans lancer.)\n";
    this.csGuiLabels["SimParamEndHFTip"]        = "TdC juste avant l’arrivée de la chasse, calcul de la difficulté de la chasse.\n"
                                                  + "(Modifier si vous pensez que votre TdC peut varier pendant la durée de la chasse, "
                                                  + "si vous prévoyez de flooder les autres chasseurs, par exemple.)";
    this.csGuiLabels["SimParamRatioTip"]        = "Ratio = Attaque AB de votre armée / Difficulté de la chasse\n"
                                                  + "Plus le ratio est faible, plus la chasse est risquée.\n"
                                                  + "Les estimations de pertes et les chances de répliques à 10% peuvent vous aider à choisir.";
    this.csGuiLabels["SimParamRatioOption"]     = "<b>$ratio &rarr; </b> Réplique 10% : $rep10 %, Pertes Moy : $avg JSN, TdC chassé : $hf <i>($count x $amount)</i>";
    this.csGuiLabels["SimParamRatioOptionTip"]  = "RATIO $ratio :\n Chances de réplique à 10 % = $rep10 %\n\n"
                                                  + " Pertes moyennes = $avg JSN\n Pertes max = $max JSN\n Pertes min = $min JSN\n\n"
                                                  + " Chasses suggérée : $hf cm²\n En chassant : $count x $amount cm².";
    this.csGuiLabels["SimParamCount"]           = "Nombre de chasse : ";
    this.csGuiLabels["SimParamAmount"]          = "TdC par chasse : ";
    this.csGuiLabels["SimParamCountTip"]        = "Nombre de chasse : si la case Auto est cochée, "
                                                  + "le programme choisira automatiquement en fonction du ratio choisi.";
    this.csGuiLabels["SimParamAmountTip"]       = "TdC par chasse : si la case Auto est cochée, "
                                                  + "le programme choisira automatiquement en fonction du ratio choisi.";
    // Details.
    this.csGuiLabels["HideSimDetails"]          = this.csGuiLabels["HideFR"] + " informations sur la chasse";
    this.csGuiLabels["DetailsHF"]               = "TdC total chassé : ";
    this.csGuiLabels["DetailsCountAmount"]      = "Divisions des chasses :";
    this.csGuiLabels["DetailsDuration"]         = "Durée de la chasse : ";
    this.csGuiLabels["DetailsETA"]              = "Retour de chasse :";
    this.csGuiLabels["DetailsHFPerDay"]         = "Rentabilité de la chasse : ";
    this.csGuiLabels["Detailscm2PerDay"]        = " cm² / jour.";
    this.csGuiLabels["DetailsHFAndTimeTip"]     = "No comment.";
    this.csGuiLabels["DetailsRatio"]            = "Ratio de votre chasse :";
    this.csGuiLabels["DetailsRatioTip"]         = "Ratio effectif de votre chasse = FdF(AB) / Difficulté";
    this.csGuiLabels["DetailsUsedRatio"]        = "Ratio de référence utilisé : ";
    this.csGuiLabels["DetailsUsedRatioTip"]     = "Ratio de référence utilisé pour les estimations de pertes en chasse.\n"
                                                  + "Le simulateur utilise le ratio de référence "
                                                  + "inférieur le plus proche au ratio réel de la chasse.";
    this.csGuiLabels["DetailsDifficulty"]       = "Difficulté de la chasse : ";
    this.csGuiLabels["DetailsFood"]             = "Nourriture récoltée : ";
    this.csGuiLabels["DetailsDifficultyTip"]    = "Difficulté de la chasse telle que calculée par le simulateur.\n"
                                                  + "Ce chiffre peut varier selon les outils utilisés "
                                                  + "(selon la formule implémentée par l’auteur du simulateur).\n"
                                                  + "Il importe surtout que ce chiffre soit proportionnel à la nourriture récoltée.\n"
                                                  + "Dans ce simulateur, nourriture récoltée = 80% de la difficulté.";
    this.csGuiLabels["DetailsEstimation"]       = "Estimation des pertes";
    this.csGuiLabels["DetailsMin"]              = "Min";
    this.csGuiLabels["DetailsAvg"]              = "Moyenne";
    this.csGuiLabels["DetailsMax"]              = "Max";
    this.csGuiLabels["DetailsAsYD"]             = "Nombre de JSN : ";
    this.csGuiLabels["DetailsAsTime"]           = "Temps de ponte : ";
    this.csGuiLabels["DetailsAsRatio"]          = "/durée de chasse : ";
    this.csGuiLabels["DisplayDuration"]         = "$day jour(s) $hour h $min min";
    this.csGuiLabels["DetailsEstimationTip"]    = "Estimations des pertes en nombre de JSN tuées.\n "
                                                  + "La techno bouclier du joueur est prise en compte.\n "
                                                  + "Basé sur un ratio de référence = plus proche inférieur (pire) au ratio réel de la chasse.\n"
                                                  + " Pour chaque ratio de référence, les pertes sont extrapolées "
                                                  + " à partir de stats portant sur des centaines de chasses "
                                                  + " réalisées sur le simulateur du compte+ (> 1500 par ratio).";
    // Other HF losses .
    this.csGuiLabels["OtherHFTipLabel"]         = "Pertes selon le niveau de TdC à l’arrivée des chasses : "
    this.csGuiLabels["OtherHFTipLabelTip"]      = "Vous avez prévu $HF cm² au retour de chasse, mais quelle pertes aurez vous si vous êtes plus haut ? Découvrez le ici."
    this.csGuiLabels["ShowOtherHF"]             = this.csGuiLabels["ShowFR"];
    this.csGuiLabels["OtherHFTip"]              = "Votre TdC doit être bas pour lancer vos chasses, afin qu’elles durent moins longtemps.\n"
                                                  + "Mais une fois que les chasses sont lancées, les variations de TdC n’influent plus"
                                                  + " sur le temps de chasse mais uniquement sur les pertes.\n"
                                                  + "Beaucoup de chasseurs ont peur de flooder les autres car ils surestiment ou "
                                                  + "ignorent l’impact exact du TdC sur les pertes.\n"
                                                  + "Cette table devrait vous donner une idée précise de l’impact du TdC sur les pertes.\n"
                                                  + "Attention cependant, que ce sont les premières chasses, la premières en particulier, "
                                                  + "qui souffrent le plus des augmentations de TdC, il est donc souhaitable qu’elles "
                                                  + "soient bien fournies en JSN (Ce que la répartition des troupes de ce simulateur "
                                                  + "fait, du moins quand vous avez plus de 2 x les pertes max prévues en JSN)."
    this.csGuiLabels["OtherHFHunt"]             = "Chasse";
    this.csGuiLabels["OtherHFHuntYourHF"]       = "<br/><i>(Votre TdC d’arrivée)</i>";
    // Hunt launch.
    this.csGuiLabels["HideSimLaunch"]           = this.csGuiLabels["HideFR"] + " lancement des chasses";
    this.csGuiLabels["LaunchWarning"]           = "Attention : ne pas quitter cette page tant que toutes les chasses ne sont pas lancées. "
                                                  + "En cas de lancement individuel des chasses, ouvrir <b>une autre</b> page ressources pour vérifier les lancements.";
    this.csGuiLabels["LaunchParamLabel"]        = "Paramétrage affichage : ";
    this.csGuiLabels["LaunchParamNum"]          = "Afficher le Numéro.";
    this.csGuiLabels["LaunchParamUnits"]        = "Afficher les unités sans effectifs.";
    this.csGuiLabels["LaunchParamMaxLoss"]      = "Afficher les pertes maximales.";
    this.csGuiLabels["LaunchParamAvgLoss"]      = "Afficher les pertes moyennes.";
    this.csGuiLabels["LaunchParamOthLoss"]      = "Afficher les pertes max pour un TdC : ";
    this.csGuiLabels["LaunchParamDiff"]         = "Afficher la difficulté des chasses.";
    this.csGuiLabels["LaunchParamAtt"]          = "Afficher l’attaque des unités de chaque chasse.";
    this.csGuiLabels["LaunchParamRatio"]        = "Afficher le ratio réel.";
    this.csGuiLabels["LaunchParamCompact"]      = "Affichage compact des unités.";
    this.csGuiLabels["LaunchParamSingle"]       = "Afficher le statut des chasses.";
    this.csGuiLabels["LaunchParamNumTip"]       = "Afficher le Numéro de chaque chasse";
    this.csGuiLabels["LaunchParamUnitsTip"]     = "Afficher la colonne de toutes les unités, y compris celles que le joueur ne possède pas.\n(Sans effet si Affichage compact des unités).";
    this.csGuiLabels["LaunchParamMaxLossTip"]   = "Afficher les pertes maximales de chaque chasse.";
    this.csGuiLabels["LaunchParamAvgLossTip"]   = "Afficher les pertes moyennes de chaque chasse.";
    this.csGuiLabels["LaunchParamOthLossTip"]   = "Afficher les pertes max pour un TdC différent de celui prévu au retour de chasse. "
                                                  + " Ceci afin de s’assurer, en cas de variation de TdC pendant la chasse, que les troupes envoyées, et en particulier les JSN sont suffisantes pour couvrir les pertes dans le pire des cas";
    this.csGuiLabels["LaunchParamDiffTip"]      = "Afficher la difficulté de chaque chasse.";
    this.csGuiLabels["LaunchParamAttTip"]       = "Afficher l’attaque des unités envoyées pour chacune des chasses.";
    this.csGuiLabels["LaunchParamRatioTip"]     = "Afficher le ratio réel de chaque chasse (Attaque AB / Difficulté).";
    this.csGuiLabels["LaunchParamCompactTip"]   = "Afficher la liste des unités envoyées dans une seule colonne plutôt que de créer une colonne par type d’unité.";
    this.csGuiLabels["LaunchParamSingleTip"]    = "Afficher le lancement individuel de chaque chasse.";
    this.csGuiLabels["LaunchALL"]               = "Lancer tout";
    this.csGuiLabels["LaunchColMax"]            = "Pertes<br/>Max";
    this.csGuiLabels["LaunchColAvg"]            = "Pertes<br/>Moyennes";
    this.csGuiLabels["LaunchColOth"]            = "Pertes<br/>Max<br/>Selon TdC";
    this.csGuiLabels["LaunchColDispatch"]       = "Unités envoyées";
    this.csGuiLabels["LaunchColDiff"]           = "Difficulté";
    this.csGuiLabels["LaunchColAtt"]            = "Attaque";
    this.csGuiLabels["LaunchColRatio"]          = "Ratio";
    this.csGuiLabels["LaunchColSingleTitle"]    = "Statut";
    this.csGuiLabels["LaunchColSingle"]         = "Lancer";
    this.csGuiLabels["LaunchColSingleTip"]      = "Lancement indiciduel de chasse, alternative au lancement de toutes les chasses en un clic";
    this.csGuiLabels["LaunchColSingleFooterTip"] = "! DEVEROUILLER la sécurité du lancement individuel des chasses !\n"
                                                  + "(Permet de re-lancer une chasse déjà lancée si elle a été annulée.)\n"
                                                  + "ATTENTION : bien lancer les chasses dans l’ordre prévu !";
  }
  // KOREAN LABELS.
  else if (oCHS2_data.csLang == "KR")
  {
    this.csGuiLabels["Title"]                   = "Hunting Simulator/Launcher";
    this.csGuiLabels["HideSimulator"]           = this.csGuiLabels["HideKR"];
    // History
    this.csGuiLabels["ShowHistory"]             = this.csGuiLabels["ShowKR"] + " Version history";
    this.csGuiLabels["History"]                 = this.csGuiLabels["HistoryKR"];
    // Import
    this.csGuiLabels["ShowImport"]             = this.csGuiLabels["ShowKR"] + " Import";
    // User data.
    this.csGuiLabels["HideUserData"]            = this.csGuiLabels["HideKR"] + " user data";
    this.csGuiLabels["UserDataRetrieve"]        = "Retrieve";
    this.csGuiLabels["UserDataRetrieveTip"]     = "Retrieve/Refresh data from current user in game data.\n(Buildings, technos, army and HF.)";
    this.csGuiLabels["UserDataImport"]          = "Import";
    this.csGuiLabels["UserDataMandatory"]       = "Mandatory data";
    this.csGuiLabels["UserDataMandatoryTip"]    = "Mandatory data to compute hunt simulation.";
    this.csGuiLabels["UserDataOptionnal"]       = "Optional data";
    this.csGuiLabels["UserDataOptionnalTip"]    = "Optional data only used to compute losses laying time.";
    this.csGuiLabels["UserDataArmy"]            = "Army";
    this.csGuiLabels["UserDataArmyTip"]         = "Mind to keep a couple million young dwarves if you wish to flood other hunters ;-)";
    this.csGuiLabels["UserDataArmyAttTip"]      = "Above army attack points with given weapon techno bonus.";
    // Sim param.
    this.csGuiLabels["HideSimParam"]            = this.csGuiLabels["HideKR"] + " hunt parameters";
    this.csGuiLabels["SimParamLaunchHF"]        = "Launching HF";
    this.csGuiLabels["SimParamEndHF"]           = "End of hunt HF";
    this.csGuiLabels["SimParamLaunchHFTip"]     = "HF when launching, used for hunt duration.\n"
                                                  + "(Do not modify if you intend to launch immediately,"
                                                  + "edit only for simulation without launching.)";
    this.csGuiLabels["SimParamEndHFTip"]        = "HF just before hunt’s end, used for hunt difficulty.\n"
                                                  + "(Edit if you thing your HF may change before hunt return, "
                                                  + " if you plane to flood other hunters for instance.)";
    this.csGuiLabels["SimParamRatioTip"]        = "Ratio = Your army attack (with weapon bonus) / Hunt difficulty\n"
                                                  + "Lesser the ratio, more dangerous the hunt.\n"
                                                  + "Losses estimations and 10% reply chances may help your choice.";
    this.csGuiLabels["SimParamRatioOption"]     = "<b>$ratio &rarr; </b> 10% reply : $rep10 %, Avg Loss : $avg JSN, Hunt amount : $hf <i>($count x $amount)</i>";
    this.csGuiLabels["SimParamRatioOptionTip"]  = "RATIO $ratio :\n 10 % reply chances = $rep10 %\n\n"
                                                  + " Average losses = $avg JSN\n Max losses = $max JSN\n Min losses = $min JSN\n\n"
                                                  + " Possible hunt : $hf cm²\n Hunting : $count x $amount cm².";
    this.csGuiLabels["SimParamCount"]           = "Hunt count : ";
    this.csGuiLabels["SimParamAmount"]          = "Hunt amount : ";
    this.csGuiLabels["SimParamCountTip"]        = "Hunt count : computed from chosen ratio if Auto is checked.";
    this.csGuiLabels["SimParamAmountTip"]       = "Hunt amount : computed from chosen ratio if Auto is checked.";
    // Details.
    this.csGuiLabels["HideSimDetails"]          = this.csGuiLabels["HideKR"] + " hunt details";
    this.csGuiLabels["DetailsHF"]               = "Total HF hunted : ";
    this.csGuiLabels["DetailsCountAmount"]      = "Hunt division :";
    this.csGuiLabels["DetailsDuration"]         = "Hunt duration : ";
    this.csGuiLabels["DetailsETA"]              = "Estimated arrival :";
    this.csGuiLabels["DetailsHFPerDay"]         = "Hunt efficiency : ";
    this.csGuiLabels["Detailscm2PerDay"]        = " cm² / day.";
    this.csGuiLabels["DetailsHFAndTimeTip"]     = "No comment.";
    this.csGuiLabels["DetailsRatio"]            = "Your hunt ratio :";
    this.csGuiLabels["DetailsRatioTip"]         = "Hunt real ratio = Army attack with bonus / Hunt difficulty";
    this.csGuiLabels["DetailsUsedRatio"]        = "Reference ratio used : ";
    this.csGuiLabels["DetailsUsedRatioTip"]     = "Reference ratio used for hunt losses estimation.\n"
                                                  + "Simulator uses reference ratio, closest lesser than real ratio.";
    this.csGuiLabels["DetailsDifficulty"]       = "Hunt difficulty : ";
    this.csGuiLabels["DetailsFood"]             = "Food granted : ";
    this.csGuiLabels["DetailsDifficultyTip"]    = "Hunt difficulty as simulator compute it.\n"
                                                  + "This value can vary from on tool to another "
                                                  + "(depending on tool’s author formula).\n"
                                                  + "It should be correct if proportional to food amount.\n"
                                                  + "In this tool, food amount = 80% difficulty.";
    this.csGuiLabels["DetailsEstimation"]       = "Estimated losses";
    this.csGuiLabels["DetailsMin"]              = "Min";
    this.csGuiLabels["DetailsAvg"]              = "Average";
    this.csGuiLabels["DetailsMax"]              = "Max";
    this.csGuiLabels["DetailsAsYD"]             = "Young dwarves number : ";
    this.csGuiLabels["DetailsAsTime"]           = "Laying time : ";
    this.csGuiLabels["DetailsAsRatio"]          = "/hunt time : ";
    this.csGuiLabels["DisplayDuration"]         = "$day day(s) $hour h $min min";
    this.csGuiLabels["DetailsEstimationTip"]    = "Estimation of losses, given as a number of young dwarves killed.\n"
                                                  + " User shield techno is taken into account.\n"
                                                  + " Based on reference ratio = lesser (worst) closest to real ratio.\n"
                                                  + " For each reference ratio, losses are estimated from stats "
                                                  + "on hundreds of option+ hunts simulations (> 1500 per ratio).";
    // Other HF losses .
    this.csGuiLabels["OtherHFTipLabel"]         = "Losses estimations for end of hunt HF variations : "
    this.csGuiLabels["OtherHFTipLabelTip"]      = "You launch for $HF cm² when your hunt ends, but what if you are higher ? Click here to know : "
    this.csGuiLabels["ShowOtherHF"]             = this.csGuiLabels["ShowKR"];
    this.csGuiLabels["OtherHFTip"]              = "You need to have a low HF to launch your hunt, "
                                                  + "because lower the HF, shorter the hunt.\n"
                                                  + "But once your hunt is launched, hunt time is settled, and "
                                                  + "you have only to care about your HF level to avoid excessive losses.\n"
                                                  + "Most hunters does not dare to flood other hunters "
                                                  + "because they over-estimate impact of HF on hunt difficulty.\n"
                                                  + "These data should allow you to have a clear view  "
                                                  + "of how HF weights on losses.\n"
                                                  + "But beware the first hunts (especially the first and up to the fifth), "
                                                  + "will suffer much more than the following. \nSo the first hunts should "
                                                  + "include a large amount of YD (which is the way this simulator "
                                                  + " dispatch units, if you have more than 2 x max losses, though)."
    this.csGuiLabels["OtherHFHunt"]             = "Hunt";
    this.csGuiLabels["OtherHFHuntYourHF"]       = "<br/><i>(Your hunt end HF)</i>";
    // Hunt launch.
    this.csGuiLabels["HideSimLaunch"]           = this.csGuiLabels["HideKR"] + " hunt launch";
    this.csGuiLabels["LaunchWarning"]           = "Warning : stay on this page until all hunts are launched. "
                                                  + "When launching single hunts, open <b>another</b> resource page to check launched hunts.";
    this.csGuiLabels["LaunchParamLabel"]        = "Display parameters : ";
    this.csGuiLabels["LaunchParamNum"]          = "Display hunt number.";
    this.csGuiLabels["LaunchParamUnits"]        = "Display unused unit types.";
    this.csGuiLabels["LaunchParamMaxLoss"]      = "Display max losses.";
    this.csGuiLabels["LaunchParamAvgLoss"]      = "Display average losses.";
    this.csGuiLabels["LaunchParamOthLoss"]      = "Display max losses for other HF : ";
    this.csGuiLabels["LaunchParamDiff"]         = "Display difficulty.";
    this.csGuiLabels["LaunchParamAtt"]          = "Display attack of sent units.";
    this.csGuiLabels["LaunchParamRatio"]        = "Display real ratio.";
    this.csGuiLabels["LaunchParamCompact"]      = "Units compact display.";
    this.csGuiLabels["LaunchParamNumTip"]       = "Display each hunt number";
    this.csGuiLabels["LaunchParamSingle"]       = "Display hunt status.";
    this.csGuiLabels["LaunchParamUnitsTip"]     = "Display each unit column, even if player have no unit of this type.\n(No effect on Units compact display).";
    this.csGuiLabels["LaunchParamMaxLossTip"]   = "Display max losses for each hunt.";
    this.csGuiLabels["LaunchParamAvgLossTip"]   = "Display average losses for each hunt.";
    this.csGuiLabels["LaunchParamOthLossTip"]   = "Display max losses for another HF than the one you expected at the end of hunt. "
                                                  + "This to check that if HF varies during hunt, sent units (and especially young dwarves), are enough for losses in the worst case.";
    this.csGuiLabels["LaunchParamDiffTip"]      = "Display difficulty for each hunt.";
    this.csGuiLabels["LaunchParamAttTip"]       = "Display attack of dispatched army for each hunt.";
    this.csGuiLabels["LaunchParamRatioTip"]     = "Display real ratio for each hunt (Attack with weapon bonus / Difficulty).";
    this.csGuiLabels["LaunchParamCompactTip"]   = "Display each hunt dispatched army as a list in a single column rather than one column for each unit type.";
    this.csGuiLabels["LaunchParamSingle"]       = "Display single hunt launch for each hunt.";
    this.csGuiLabels["LaunchALL"]               = "Launch All";
    this.csGuiLabels["LaunchColMax"]            = "Max<br/>Losses";
    this.csGuiLabels["LaunchColAvg"]            = "Average<br/>Losses";
    this.csGuiLabels["LaunchColOth"]            = "Max<br/>Losses<br/>other HF";
    this.csGuiLabels["LaunchColDispatch"]       = "Sent units";
    this.csGuiLabels["LaunchColDiff"]           = "Difficulty";
    this.csGuiLabels["LaunchColAtt"]            = "Attack";
    this.csGuiLabels["LaunchColRatio"]          = "Ratio";
    this.csGuiLabels["LaunchColSingleTitle"]    = "Status";
    this.csGuiLabels["LaunchColSingle"]         = "Launch";
    this.csGuiLabels["LaunchColSingleTip"]      = "Single hunt launch, rather than launching all hunts at once.";
    this.csGuiLabels["LaunchColSingleFooterTip"] = "! UNLOCK single hunt launche security !\n"
                                                  + "(Allow to launch again a cancelled hunt.)\n"
                                                  + "WARNING : beware to launch each hunt in required sequence !";
  }
  // ENGLISH LABELS.
  else
  {
    this.csGuiLabels["Title"]                   = "Hunting Simulator/Launcher";
    this.csGuiLabels["HideSimulator"]           = this.csGuiLabels["HideEN"];
    // History
    this.csGuiLabels["ShowHistory"]             = this.csGuiLabels["ShowEN"] + " Version history";
    this.csGuiLabels["History"]                 = this.csGuiLabels["HistoryEN"];
    // Import
    this.csGuiLabels["ShowImport"]             = this.csGuiLabels["ShowEN"] + " Import";
    // User data.
    this.csGuiLabels["HideUserData"]            = this.csGuiLabels["HideEN"] + " user data";
    this.csGuiLabels["UserDataRetrieve"]        = "Retrieve";
    this.csGuiLabels["UserDataRetrieveTip"]     = "Retrieve/Refresh data from current user in game data.\n(Buildings, technos, army and HF.)";
    this.csGuiLabels["UserDataImport"]          = "Import";
    this.csGuiLabels["UserDataMandatory"]       = "Mandatory data";
    this.csGuiLabels["UserDataMandatoryTip"]    = "Mandatory data to compute hunt simulation.";
    this.csGuiLabels["UserDataOptionnal"]       = "Optional data";
    this.csGuiLabels["UserDataOptionnalTip"]    = "Optional data only used to compute losses laying time.";
    this.csGuiLabels["UserDataArmy"]            = "Army";
    this.csGuiLabels["UserDataArmyTip"]         = "Mind to keep a couple million young dwarves if you wish to flood other hunters ;-)";
    this.csGuiLabels["UserDataArmyAttTip"]      = "Above army attack points with given weapon techno bonus.";
    // Sim param.
    this.csGuiLabels["HideSimParam"]            = this.csGuiLabels["HideEN"] + " hunt parameters";
    this.csGuiLabels["SimParamLaunchHF"]        = "Launching HF";
    this.csGuiLabels["SimParamEndHF"]           = "End of hunt HF";
    this.csGuiLabels["SimParamLaunchHFTip"]     = "HF when launching, used for hunt duration.\n"
                                                  + "(Do not modify if you intend to launch immediately,"
                                                  + "edit only for simulation without launching.)";
    this.csGuiLabels["SimParamEndHFTip"]        = "HF just before hunt’s end, used for hunt difficulty.\n"
                                                  + "(Edit if you thing your HF may change before hunt return, "
                                                  + " if you plane to flood other hunters for instance.)";
    this.csGuiLabels["SimParamRatioTip"]        = "Ratio = Your army attack (with weapon bonus) / Hunt difficulty\n"
                                                  + "Lesser the ratio, more dangerous the hunt.\n"
                                                  + "Losses estimations and 10% reply chances may help your choice.";
    this.csGuiLabels["SimParamRatioOption"]     = "<b>$ratio &rarr; </b> 10% reply : $rep10 %, Avg Loss : $avg JSN, Hunt amount : $hf <i>($count x $amount)</i>";
    this.csGuiLabels["SimParamRatioOptionTip"]  = "RATIO $ratio :\n 10 % reply chances = $rep10 %\n\n"
                                                  + " Average losses = $avg JSN\n Max losses = $max JSN\n Min losses = $min JSN\n\n"
                                                  + " Possible hunt : $hf cm²\n Hunting : $count x $amount cm².";
    this.csGuiLabels["SimParamCount"]           = "Hunt count : ";
    this.csGuiLabels["SimParamAmount"]          = "Hunt amount : ";
    this.csGuiLabels["SimParamCountTip"]        = "Hunt count : computed from chosen ratio if Auto is checked.";
    this.csGuiLabels["SimParamAmountTip"]       = "Hunt amount : computed from chosen ratio if Auto is checked.";
    // Details.
    this.csGuiLabels["HideSimDetails"]          = this.csGuiLabels["HideEN"] + " hunt details";
    this.csGuiLabels["DetailsHF"]               = "Total HF hunted : ";
    this.csGuiLabels["DetailsCountAmount"]      = "Hunt division :";
    this.csGuiLabels["DetailsDuration"]         = "Hunt duration : ";
    this.csGuiLabels["DetailsETA"]              = "Estimated arrival :";
    this.csGuiLabels["DetailsHFPerDay"]         = "Hunt efficiency : ";
    this.csGuiLabels["Detailscm2PerDay"]        = " cm² / day.";
    this.csGuiLabels["DetailsHFAndTimeTip"]     = "No comment.";
    this.csGuiLabels["DetailsRatio"]            = "Your hunt ratio :";
    this.csGuiLabels["DetailsRatioTip"]         = "Hunt real ratio = Army attack with bonus / Hunt difficulty";
    this.csGuiLabels["DetailsUsedRatio"]        = "Reference ratio used : ";
    this.csGuiLabels["DetailsUsedRatioTip"]     = "Reference ratio used for hunt losses estimation.\n"
                                                  + "Simulator uses reference ratio, closest lesser than real ratio.";
    this.csGuiLabels["DetailsDifficulty"]       = "Hunt difficulty : ";
    this.csGuiLabels["DetailsFood"]             = "Food granted : ";
    this.csGuiLabels["DetailsDifficultyTip"]    = "Hunt difficulty as simulator compute it.\n"
                                                  + "This value can vary from on tool to another "
                                                  + "(depending on tool’s author formula).\n"
                                                  + "It should be correct if proportional to food amount.\n"
                                                  + "In this tool, food amount = 80% difficulty.";
    this.csGuiLabels["DetailsEstimation"]       = "Estimated losses";
    this.csGuiLabels["DetailsMin"]              = "Min";
    this.csGuiLabels["DetailsAvg"]              = "Average";
    this.csGuiLabels["DetailsMax"]              = "Max";
    this.csGuiLabels["DetailsAsYD"]             = "Young dwarves number : ";
    this.csGuiLabels["DetailsAsTime"]           = "Laying time : ";
    this.csGuiLabels["DetailsAsRatio"]          = "/hunt time : ";
    this.csGuiLabels["DisplayDuration"]         = "$day day(s) $hour h $min min";
    this.csGuiLabels["DetailsEstimationTip"]    = "Estimation of losses, given as a number of young dwarves killed.\n"
                                                  + " User shield techno is taken into account.\n"
                                                  + " Based on reference ratio = lesser (worst) closest to real ratio.\n"
                                                  + " For each reference ratio, losses are estimated from stats "
                                                  + "on hundreds of option+ hunts simulations (> 1500 per ratio).";
    // Other HF losses .
    this.csGuiLabels["OtherHFTipLabel"]         = "Losses estimations for end of hunt HF variations : "
    this.csGuiLabels["OtherHFTipLabelTip"]      = "You launch for $HF cm² when your hunt ends, but what if you are higher ? Click here to know : "
    this.csGuiLabels["ShowOtherHF"]             = this.csGuiLabels["ShowEN"];
    this.csGuiLabels["OtherHFTip"]              = "You need to have a low HF to launch your hunt, "
                                                  + "because lower the HF, shorter the hunt.\n"
                                                  + "But once your hunt is launched, hunt time is settled, and "
                                                  + "you have only to care about your HF level to avoid excessive losses.\n"
                                                  + "Most hunters does not dare to flood other hunters "
                                                  + "because they over-estimate impact of HF on hunt difficulty.\n"
                                                  + "These data should allow you to have a clear view  "
                                                  + "of how HF weights on losses.\n"
                                                  + "But beware the first hunts (especially the first and up to the fifth), "
                                                  + "will suffer much more than the following. \nSo the first hunts should "
                                                  + "include a large amount of YD (which is the way this simulator "
                                                  + " dispatch units, if you have more than 2 x max losses, though)."
    this.csGuiLabels["OtherHFHunt"]             = "Hunt";
    this.csGuiLabels["OtherHFHuntYourHF"]       = "<br/><i>(Your hunt end HF)</i>";
    // Hunt launch.
    this.csGuiLabels["HideSimLaunch"]           = this.csGuiLabels["HideEN"] + " hunt launch";
    this.csGuiLabels["LaunchWarning"]           = "Warning : stay on this page until all hunts are launched. "
                                                  + "When launching single hunts, open <b>another</b> resource page to check launched hunts.";
    this.csGuiLabels["LaunchParamLabel"]        = "Display parameters : ";
    this.csGuiLabels["LaunchParamNum"]          = "Display hunt number.";
    this.csGuiLabels["LaunchParamUnits"]        = "Display unused unit types.";
    this.csGuiLabels["LaunchParamMaxLoss"]      = "Display max losses.";
    this.csGuiLabels["LaunchParamAvgLoss"]      = "Display average losses.";
    this.csGuiLabels["LaunchParamOthLoss"]      = "Display max losses for other HF : ";
    this.csGuiLabels["LaunchParamDiff"]         = "Display difficulty.";
    this.csGuiLabels["LaunchParamAtt"]          = "Display attack of sent units.";
    this.csGuiLabels["LaunchParamRatio"]        = "Display real ratio.";
    this.csGuiLabels["LaunchParamCompact"]      = "Units compact display.";
    this.csGuiLabels["LaunchParamNumTip"]       = "Display each hunt number";
    this.csGuiLabels["LaunchParamSingle"]       = "Display hunt status.";
    this.csGuiLabels["LaunchParamUnitsTip"]     = "Display each unit column, even if player have no unit of this type.\n(No effect on Units compact display).";
    this.csGuiLabels["LaunchParamMaxLossTip"]   = "Display max losses for each hunt.";
    this.csGuiLabels["LaunchParamAvgLossTip"]   = "Display average losses for each hunt.";
    this.csGuiLabels["LaunchParamOthLossTip"]   = "Display max losses for another HF than the one you expected at the end of hunt. "
                                                  + "This to check that if HF varies during hunt, sent units (and especially young dwarves), are enough for losses in the worst case.";
    this.csGuiLabels["LaunchParamDiffTip"]      = "Display difficulty for each hunt.";
    this.csGuiLabels["LaunchParamAttTip"]       = "Display attack of dispatched army for each hunt.";
    this.csGuiLabels["LaunchParamRatioTip"]     = "Display real ratio for each hunt (Attack with weapon bonus / Difficulty).";
    this.csGuiLabels["LaunchParamCompactTip"]   = "Display each hunt dispatched army as a list in a single column rather than one column for each unit type.";
    this.csGuiLabels["LaunchParamSingle"]       = "Display single hunt launch for each hunt.";
    this.csGuiLabels["LaunchALL"]               = "Launch All";
    this.csGuiLabels["LaunchColMax"]            = "Max<br/>Losses";
    this.csGuiLabels["LaunchColAvg"]            = "Average<br/>Losses";
    this.csGuiLabels["LaunchColOth"]            = "Max<br/>Losses<br/>other HF";
    this.csGuiLabels["LaunchColDispatch"]       = "Sent units";
    this.csGuiLabels["LaunchColDiff"]           = "Difficulty";
    this.csGuiLabels["LaunchColAtt"]            = "Attack";
    this.csGuiLabels["LaunchColRatio"]          = "Ratio";
    this.csGuiLabels["LaunchColSingleTitle"]    = "Status";
    this.csGuiLabels["LaunchColSingle"]         = "Launch";
    this.csGuiLabels["LaunchColSingleTip"]      = "Single hunt launch, rather than launching all hunts at once.";
    this.csGuiLabels["LaunchColSingleFooterTip"] = "! UNLOCK single hunt launche security !\n"
                                                  + "(Allow to launch again a cancelled hunt.)\n"
                                                  + "WARNING : beware to launch each hunt in required sequence !";
  }

};

// ________________________________________________________________________________
// Compute hunt ratio select list data.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeRatiosLabels = function(p_nArmyAtt, p_nHuntSpeed, p_nEndHF, p_nHuntMinHF, p_nUserShield)
{
  var csHunt1     = ".";
  var csHunt2     = "";
  var dDifficulty = 0.0;
  var nHunts;
  var nLosses;
  var bAllDataAvailable = false;
  // build a fixed length monospace text from value and parameters, embedded in a <span>.
  var csSC = function(p_nValue, p_nLength, p_nDecimal, p_csStyle) { return "<span style='font-family:monospace; "+ p_csStyle + "'> " + oCHS2_util.LengthFormat(oCHS2_util.Format(p_nValue, p_nDecimal, " "), p_nLength, true, "&nbsp;") + "</span>"; }

  for (var i = 0; i < this.dHuntsRatiosValues.length; i++)
  {
    bAllDataAvailable = (p_nArmyAtt > 0 && p_nEndHF > 0 && p_nHuntMinHF > 0);

    // Ratio select list items labels.
    this.csHuntsRatiosLabels[i] = this.csGuiLabels["SimParamRatioOption"];
    this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$ratio", csSC(this.dHuntsRatiosValues[i], 4, 1, "font-size:16px; ")); //
    this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$rep10", csSC(Math.round(100 * this.dHuntsRatios10pcReplyChances[i]), 2, 0, ""));
    if (bAllDataAvailable)
    {
      nHunts  = this.ComputeHunts(this.dHuntsRatiosValues[i], p_nArmyAtt, p_nHuntSpeed, p_nEndHF, p_nHuntMinHF, 0, 0);
      dDifficulty   = this.ComputeDifficulty(p_nEndHF, nHunts["HF"], nHunts["NB"]);
      nLosses = this.ComputeLosses(i, dDifficulty, p_nUserShield);

      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$avg", csSC(nLosses["AVG"], 13, 0, ""));
      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$hf", csSC(nHunts["NB"] * nHunts["HF"], 13, 0, ""));
      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$count", nHunts["NB"]);
      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$amount", oCHS2_util.Format(nHunts["HF"], 0, " "));
    } else
    {
      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$avg", "N/A");
      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$hf", "N/A");
      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$count", "N/A");
      this.csHuntsRatiosLabels[i] = this.csHuntsRatiosLabels[i].replace("$amount", "N/A");
   }

    // Ratio select list items tips.
    this.csHuntsRatioTips[i] = this.csGuiLabels["SimParamRatioOptionTip"];
    this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$ratio", oCHS2_util.Format(this.dHuntsRatiosValues[i], 1, " "));
    this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$rep10", Math.round(100 * this.dHuntsRatios10pcReplyChances[i]));
    if (bAllDataAvailable)
    {
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$avg", oCHS2_util.Format(nLosses["AVG"], 0, " "));
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$max", oCHS2_util.Format(nLosses["MAX"], 0, " "));
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$min", oCHS2_util.Format(nLosses["MIN"], 0, " "));
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$hf", oCHS2_util.Format(nHunts["NB"] * nHunts["HF"], 0, " "));
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$count", oCHS2_util.Format(nHunts["NB"], 0, " "));
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$amount", oCHS2_util.Format(nHunts["HF"], 0, " "));
    } else
    {
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$avg", "N/A");
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$max", "N/A");
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$min", "N/A");
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$hf", "N/A");
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$count", "N/A");
      this.csHuntsRatioTips[i] = this.csHuntsRatioTips[i].replace("$amount", "N/A");
    }
    // If auto hunt count and amount update them (mainly for initialisation).
    /*if (i == this.nSelectedRefRatioIndex && bAllDataAvailable)
    {
      if (GEBI("CHS2_HuntParamHuntNbAutoCB").checked && GEBI("CHS2_HuntParamHuntHFAutoCB").checked)
      {
        this.nHuntCount   = nHunts["NB"];
        this.nHuntAmount  = nHunts["HF"];
      }
    }*/
  }
};

// ________________________________________________________________________________
// Compute Possible Hunts...
// TODO : find a better way than this old piece of code (back from 2009 Excel version of simulator !!!!)
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeHunts = function(p_nRatio, p_nArmyAtt, p_nHuntSpeed, p_nEndHF, p_nHuntMinHF, p_nFixedHuntNb, p_nFixedHuntCm2)
{
  var nHuntAmount, nHuntCount, nHuntMaxCount;
  var nRatio = p_nRatio + 0.0001;

  var nComputedHunts = new Array();

  nEndHF = p_nEndHF;
  nHuntAmount = p_nFixedHuntCm2 > 0 ? p_nFixedHuntCm2 : p_nHuntMinHF;
  nHuntMaxCount = p_nHuntSpeed + 1;
  nHuntCount = p_nFixedHuntNb > 0 ? p_nFixedHuntNb : 1;

  // Try to set the number of hunt.
  if (p_nFixedHuntNb == 0)
  {
    while (this.ComputeRatio(nEndHF, nHuntAmount, nHuntCount + 1, p_nArmyAtt) >= nRatio && nHuntCount < nHuntMaxCount)
    {
      nHuntCount += 1;
    }
  }

  // If the hunt is too difficult, try to reduce hunted amount.
  if (p_nFixedHuntCm2 == 0)
  {
    var bBoucle = (nHuntAmount > 5000000000000);
    for (var j = 5000000000000; j > 4; j = j / 10)
    {
      bBoucle = (nHuntAmount > j);
      if (bBoucle)
      {
        bBoucle = (this.ComputeRatio(nEndHF, nHuntAmount - j, nHuntCount, p_nArmyAtt) < nRatio && nHuntAmount > 1);
      }
      while (bBoucle)
      {
        nHuntAmount -= j;
        bBoucle = nHuntAmount > j;
        if (bBoucle)
        {
          bBoucle = (this.ComputeRatio(nEndHF, nHuntAmount - j, nHuntCount, p_nArmyAtt) < nRatio && nHuntAmount > 1);
        }
      }
    }

    bBoucle = nHuntAmount > 1;
    if (bBoucle)
    {
      bBoucle = (this.ComputeRatio(nEndHF, nHuntAmount - 1, nHuntCount, p_nArmyAtt) < nRatio && nHuntAmount > 1);
    }
    while (bBoucle)
    {
      nHuntAmount -= 1;
      bBoucle = nHuntAmount > 1;
      if (bBoucle)
      {
        bBoucle = (this.ComputeRatio(nEndHF, nHuntAmount - 1, nHuntCount, p_nArmyAtt) < nRatio && nHuntAmount > 1);
      }
    }

    // if the hunt is easier than specified, try to increase hunt amount.
    for (var j = 5000000000000; j > 4; j = j /10)
    {
      while (this.ComputeRatio(nEndHF, nHuntAmount + j, nHuntCount, p_nArmyAtt) >= nRatio)
      {
        nHuntAmount += j;
      }
    }

    while (this.ComputeRatio(nEndHF, nHuntAmount + 1, nHuntCount, p_nArmyAtt) >= nRatio)
    {
      nHuntAmount += 1;
    }
  }
  nComputedHunts["NB"] = nHuntCount;
  nComputedHunts["HF"] = nHuntAmount;

  return nComputedHunts;
};

// ________________________________________________________________________________
// Compute Att / Diff ratio.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeRatio = function(p_nEndHF, p_nHuntAmount, p_nHuntCount, p_nArmyAtt)
{
  var iRet;
  iRet = p_nArmyAtt / this.ComputeDifficulty(p_nEndHF, p_nHuntAmount, p_nHuntCount);
  return iRet;
};

// ________________________________________________________________________________
// Get reference ratio index from real ratio..
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.getRefRatioIndex = function(p_nRealRatioValue)
{
  var nRefRatioIndex = 0;
  for (var i = 0; i < this.dHuntsRatiosValues.length; i++)  { if (this.dHuntsRatiosValues[i] <= (p_nRealRatioValue + 0.0001)) nRefRatioIndex = i; }
  return nRefRatioIndex;
};

// ________________________________________________________________________________
// Compute Hunt difficulty.
// E = (C + D * 0,01)  *  (1,04 ^ (ROUND(LN(D / 50) / LN(10 ^ 0,1); 0)))
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeDifficulty = function(p_nEndHF, p_nHuntAmount, p_nHuntCount)
{
  var dDifficulty, dStart;

  dDifficulty = 0;
  for (var iIter = 0; iIter <  p_nHuntCount; iIter++)
  {
    dStart = p_nEndHF + p_nHuntAmount * iIter;
    //old version (Excel) : dDifficulty = dDifficulty + (p_nHuntAmount + dStart * 0.01) * (Math.pow(1.04, (Math.round(Math.log(dStart / 50) / Math.log(Math.pow(10, 0.1))))));
    dDifficulty = dDifficulty + (p_nHuntAmount + dStart * 0.01) * (Math.pow(1.04, (Math.round(Math.log(dStart / 50) / Math.log(Math.pow(10, 0.1)))))) * 3;
  }

  return dDifficulty;
}
// .
// ________________________________________________________________________________
// Compute single hunt difficulty.
// E = (C + D * 0,01)  *  (1,04 ^ (ROUND(LN(D / 50) / LN(10 ^ 0,1); 0)))
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeSingleDifficulty = function(p_nHF, p_nHuntAmount)
{
  var ret = ((p_nHuntAmount + p_nHF * 0.01) * (Math.pow(1.04, (Math.round(Math.log(p_nHF / 50) / Math.log(Math.pow(10, 0.1)))))) * 3);
  return ret;
};

// ________________________________________________________________________________
// Compute Losses.
// =SI(P39>=P47;RECHERCHEH(P39;Stats!B2:AK6;3;VRAI)*P37/(1+0,1*E10);"NA")
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeLosses = function(p_nRatioIndex, p_nDifficulty, p_nUserShield)
{
  var nComputedLosses = new Array();
  var csTemp = "CHS2_Simu.ComputeLosses(" + p_nRatioIndex + ", " + p_nDifficulty + ", " + p_nUserShield + ") : ";
  if (isNaN(p_nDifficulty)) alert(csTemp + "isNaN(p_nDifficulty)");
  if (isNaN(p_nUserShield)) alert(csTemp + "isNaN(p_nUserShield)");

  nComputedLosses["MIN"] = (this.dHuntsRatiosMinLosses[p_nRatioIndex]) * p_nDifficulty / (10 + p_nUserShield) * 10;
  nComputedLosses["AVG"] = (this.dHuntsRatiosAvgLosses[p_nRatioIndex]) * p_nDifficulty / (10 + p_nUserShield) * 10;
  nComputedLosses["MAX"] = (this.dHuntsRatiosMaxLosses[p_nRatioIndex]) * p_nDifficulty / (10 + p_nUserShield) * 10;

  return nComputedLosses;
}

// ________________________________________________________________________________
// Display simulator.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.buildGUI = function()
{
  var csTemp;
  var i;
  // inner HTM to past at bottom of resource page
  var csContent = "";

  // Simulator overall div.
  csContent += "<div id='CHS2_MainFrame' class='boite_amelioration' style='border-style:solid; border-width:1px;'>";

  //  #####  HTML : TITLE  #####

  csContent += "<div id='CHS2_TitleFrame' class='boite_amelioration' >"; //style='border-bottom-style:solid; border-bottom-width:1px;'
  csContent += "  <table class='boite_amelioration' id='CHS2_SimuTitleTable' cellspacing='10'><tbody><tr><td>";
  csContent += "    <span id='CHS2_Title' class='titre'> 🚧 BETA Version : 2.00.35 beta 03 🚧<br/>" + this.csGuiLabels["Title"] + " </span>";
  csContent += "    <a id='CHS2_DisplaySimulator' style='padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplaySimulator'> &#x25B2; " + this.csGuiLabels["HideSimulator"] + " &#x25B2; </a>";
  csContent += "    <a id='CHS2_DisplayHistory' style='font-size:0.7em; padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplaySimulator'> &#x25BC; " + this.csGuiLabels["ShowHistory"] + " &#x25BC; </a>";
  csContent += "    <a id='CHS2_DisplayImport' style='font-size:0.7em; padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplayImport'> &#x25BC; " + this.csGuiLabels["ShowImport"] + " &#x25BC; </a> <br/>";
  csContent += "  </td></tr></tbody></table>";
  csContent += "</div>";

  csContent += "<div id='CHS2_HistoryDiv' class='boite_amelioration' style='display:none; font-size:0.9em;'><hr/>";
  csContent += "  <div id='CHS2_HistoryDiv' class='boite_amelioration' style='margin-left:20px; margin-right:20px; padding-left:20px; padding-right:20px;'>";
  csContent +=      this.csGuiLabels["History"];
  csContent += "  </div>";
  csContent += "<br/></div>";

  csContent += "<div id='CHS2_ImportDiv' class='boite_amelioration' style='display:none; font-size:0.9em;'><hr/>";
  csContent += "  <div id='CHS2_ImportDiv2' class='boite_amelioration' style='margin-left:20px; margin-right:20px; padding-left:20px; padding-right:20px;'>";
  csContent += "    <a name='CHS2_ImportLabel'  style='font-weight: bold; font-size:120%;'>Input : <i>coller ici l'armée à importer / past here army to import</i></a><br/><br/>";
  csContent += "    <textarea type='text' name='CHS2_ImportRawDatas' id='CHS2_ImportRawDatas' style='width:100%;height:400px;'></textarea>";
  csContent += "    <a id='CHS2_ImportCmd' name='CHS2_ImportCmd' style='text-decoration:underline; cursor:pointer; color:#660099;'><center><b> <h1>&#8595; Import &#8595; </h1> </b></center></a>";
  csContent += "  </div>";
  csContent += "<br/></div>";

  csContent += "<div id='CHS2_SimultorDiv' class='boite_amelioration' style='display:block;'>";
  csContent += "<hr/>";

  //   #####  HTML : USER DATA  #####

  // Show/Hide user data div
  csContent += "<a id='CHS2_DisplayUserData' style='padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplayUserData'> &#x25B2; " + this.csGuiLabels["HideUserData"] + " &#x25B2; </a> <br/>";

  // User data div
  csContent += "<div id='CHS2_UserDataFrame' class='boite_amelioration' style='display:block;'>";

  // Building and techno input.
  csContent += "<table class='boite_amelioration' id='CHS2_SimuUserDataTable' cellspacing='10'><tbody>";
  csContent += "  <tr>";
  csContent += "    <td id='CHS2_InputTableMandatoryTechLabel' colspan='2' align='left' style='text-decoration:underline; text-shadow: 2px 2px 2px #660099;' title='" + this.csGuiLabels["UserDataMandatoryTip"] + "'> " + this.csGuiLabels["UserDataMandatory"] + " </td>";
  csContent += "    <td id='CHS2_InputTableOptionnalTechLabel' colspan='2' align='left' style='text-decoration:underline; text-shadow: 2px 2px 2px #660099;' title='" + this.csGuiLabels["UserDataOptionnalTip"] + "'> " + this.csGuiLabels["UserDataOptionnal"] + " </td>";
  // Retrieve/Refresh button.
  csContent += "    <td id='CHS2_InputTableRetrieveTD' rowspan='4' align='center' style='padding-left:30px;padding-right:30px;' title='" + this.csGuiLabels["UserDataRetrieveTip"] + "'>";
  csContent += "      <button type='button' id='CHS2_InputTableRetrieve'>";
  csContent += "        <center><b>";
  csContent += "";  // Fzzz : image hébergée sur free.fr retirée (aucune requête vers un tiers)
  csContent += "        <a id='CHS2_InputFormRetrieveLabel'> " + this.csGuiLabels["UserDataRetrieve"] + "</a>";
  csContent += "        </b></center>";
  csContent += "      </button>";
  csContent += "    </td>";
  csContent += "  </tr>";
  // Weapon input / Mandatory
  csContent += "  <tr>";
  csContent += "    <td id='CHS2_InputTableWeapon' title='" + this.csGuiLabels["UserDataMandatoryTip"] + "'> " + oCHS2_data.csTechnoNames[2] + " </td>";
  csContent += "    <td id='CHS2_InputTableWeaponVal' style='line-height:15px;padding-right:50px;' title='" + this.csGuiLabels["UserDataMandatoryTip"] + "'>";
  csContent += "      <input type='text' id='CHS2_InputTableWeaponInput' size='3' style='text-align:right;' />";
  csContent += "    </td>";
  // Incubator input / Optionnal
  csContent += "    <td id='CHS2_InputTableIncubator' title='" + this.csGuiLabels["UserDataOptionnalTip"] + "'> " + oCHS2_data.csBuildingNames[3] + " </td>";
  csContent += "    <td id='CHS2_InputTableIncubatorVal' style='line-height:15px;padding-right:50px;' title='" + this.csGuiLabels["UserDataOptionnalTip"] + "'>";
  csContent += "      <input type='text' id='CHS2_InputTableIncubatorInput' size='3' style='text-align:right;' />";
  csContent += "    </td>";
  csContent += "  </tr>";
  // Shield input / Mandatory
  csContent += "  <tr>";
  csContent += "    <td id='CHS2_InputTableShield' title='" + this.csGuiLabels["UserDataMandatoryTip"] + "'> " + oCHS2_data.csTechnoNames[1] + " </td>";
  csContent += "    <td id='CHS2_InputTableShieldVal' style='line-height:15px;padding-right:50px;' title='" + this.csGuiLabels["UserDataMandatoryTip"] + "'>";
  csContent += "      <input type='text' id='CHS2_InputTableShieldInput' size='3' style='text-align:right;' />";
  csContent += "    </td>";
  // Solarium input / Optionnal
  csContent += "    <td id='CHS2_InputTableSolarium' title='" + this.csGuiLabels["UserDataOptionnalTip"] + "'> " + oCHS2_data.csBuildingNames[4] + " </td>";
  csContent += "    <td id='CHS2_InputTableSolariumVal' style='line-height:15px;padding-right:50px;' title='" + this.csGuiLabels["UserDataOptionnalTip"] + "'>";
  csContent += "      <input type='text' id='CHS2_InputTableSolariumInput' size='3' style='text-align:right;' />";
  csContent += "    </td>";
  csContent += "  </tr>";
  // Hunt Speed input / Mandatory
  csContent += "  <tr>";
  csContent += "    <td id='CHS2_InputTableHuntSpeed' title='" + this.csGuiLabels["UserDataMandatoryTip"] + "'> " + oCHS2_data.csTechnoNames[5] + " </td>";
  csContent += "    <td id='CHS2_InputTableHuntSpeedVal' style='line-height:15px;padding-right:50px;' title='" + this.csGuiLabels["UserDataMandatoryTip"] + "'>";
  csContent += "      <input type='text' id='CHS2_InputTableHuntSpeedInput' size='3' style='text-align:right;' />";
  csContent += "    </td>";
  // Laying device input / Optional
  csContent += "    <td id='CHS2_InputTableLayingDevice' title='" + this.csGuiLabels["UserDataOptionnalTip"] + "'> " + oCHS2_data.csTechnoNames[0] + " </td>";
  csContent += "    <td id='CHS2_InputTableLayingDeviceVal' style='line-height:15px;padding-right:50px;' title='" + this.csGuiLabels["UserDataOptionnalTip"] + "'>";
  csContent += "      <input type='text' id='CHS2_InputTableLayingDeviceInput' size='3' style='text-align:right;' />";
  csContent += "    </td>";
  csContent += "  </tr>";
  csContent += "</tbody></table>";

  // User Army.
  csContent += "<table class='boite_amelioration' id='CHS2_SimuUserArmyTable' title='" + this.csGuiLabels["UserDataArmyTip"]  + "'><tbody>";
  csContent += "  <tr><td  colspan='3'>";
  csContent += "    <span style='text-decoration:underline; text-shadow: 2px 2px 2px #660099;'> " + this.csGuiLabels["UserDataArmy"] + " </span>";
  csContent += "  </td></tr>";
  for (i = 1; i < oCHS2_data.csUnitNamesDisplay.length; i++)
  {
    csContent +=
      "<tr>" +
      "  <td id='" + "CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[i]) + "Label" + "' style='padding-right:30px;' >" +
           oCHS2_data.csUnitNamesDisplay[i] +
      "  </td>" +
      "  <td  style='padding-right:10px;text-align:right;' > " +
      "    <input type='text' id='" + "CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[i]) + "Input" + "' size='15' style='text-align:right;' />" +
      "  </td>" +
      "  <td id='" + "CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[i]) + "Comment" + "' style='font-style: italic; color: Gray; text-align: right;'>" +
      "    (0 Max)" +
      "  </td>" +
      "</tr>";
  }
  csContent += "<tr title='" + this.csGuiLabels["UserDataArmyAttTip"]  + "'><td id='CHS2_ArmyAtt' colspan='3' style='font-style: italic; color: Gray; text-align: center;'>(Att = 0)</td></tr>";
  csContent += "</tbody></table>";
  csContent += "</div>";
  csContent += "<br/><hr/>";

  //   #####  HTML : HUNT PARAM  #####

  // Show/Hide simulation parameters div.
  csContent += "<a id='CHS2_DisplaySimParam' style='padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplaySimParam'> &#x25B2; " + this.csGuiLabels["HideSimParam"] + " &#x25B2; </a> <br/>";

  // Simulation parameters div.
  csContent += "<div id='CHS2_SimParamFrame' class='boite_amelioration' style='display:block;'>";
  csContent += "<table class='boite_amelioration' id='CHS2_SimParamTable' cellspacing='10'><tbody>";
  csContent += "  <tr>";

  // Launch HF.
  csContent += "    <td id='CHS2_InputLaunchHFLabel' align='left' style='text-decoration:underline; text-shadow: 2px 2px 2px #660099;'  title='" + this.csGuiLabels["SimParamLaunchHFTip"] + "'> ";
  csContent +=         this.csGuiLabels["SimParamLaunchHF"];
  csContent += "    </td>";
  csContent += "    <td id='CHS2_InputLaunchHFVal' align='left' style='text-decoration:underline; text-shadow: 2px 2px 2px #660099;'  title='" + this.csGuiLabels["SimParamLaunchHFTip"] + "'> ";
  csContent += "      <input type='text' id='CHS2_InputLaunchHFValInput' size='15' style='text-align:right;' value='"+ oCHS2_util.Format(this.nBaseHF, 0, " ") + "' />";
  csContent += "    </td>";

  // End of hunt HF.
  csContent += "    <td id='CHS2_InputEndHFLabel' align='left' style='padding-left:40px; text-decoration:underline; text-shadow: 2px 2px 2px #660099;'  title='" + this.csGuiLabels["SimParamEndHFTip"] + "'> ";
  csContent +=         this.csGuiLabels["SimParamEndHF"];
  csContent += "    </td>";
  csContent += "    <td id='CHS2_InputEndHFVal' align='left' style='text-decoration:underline; text-shadow: 2px 2px 2px #660099;'  title='" + this.csGuiLabels["SimParamEndHFTip"] + "'> ";
  csContent += "      <input type='text' id='CHS2_InputEndHFValInput' size='15' style='text-align:right;' value='"+ oCHS2_util.Format(this.nEndHF, 0, " ") + "' />";
  csContent += "    </td>";
  csContent += "  </tr>";

  // Ratio selection.
  csContent += "  <tr title='" + this.csGuiLabels["SimParamRatioTip"] + "'>";
  csContent += "    <td colspan='4' align='center' style='line-height:55px;' >";
  csContent += "      <a id='CHS2_HuntParamBaseRatioLabel'> "; //onclick='ToggleSubByID('HuntParamBaseRatioDiv');'
  csContent += "        <b>Ratio :</b>";
  csContent += "      </a>&nbsp;&nbsp;&nbsp;";
  csContent += "      <select id='CHS2_HuntParamBaseRatioSelect' size='1'";
  csContent += "        style='text-align:left; font-size:12px; background:" + this.csHuntsRatiosBGcolors[this.nDefaultRatioIndex]
                          + ";color:" + this.csHuntsRatiosColors[this.nDefaultRatioIndex] + ";'>";
  for (var i = 0; i < this.dHuntsRatiosValues.length; i++)
  {
    csContent +=
        "<option " + (i == this.nDefaultRatioIndex ? " selected " : "") + "  style='background:" + this.csHuntsRatiosBGcolors[i] + ";color:" + this.csHuntsRatiosColors[i] + ";'>"
      +    this.dHuntsRatiosValues[i]
      + "</option>";
  }
  csContent += "      </select>";
  csContent += "    </td>";
  csContent += "  </tr>";

  // Hunt count input.
  csContent += "  <tr>";
  csContent += "    <b>";
  csContent += "    <td id='CHS2_HuntParamHuntNbLabel' style='line-height:20px; ' title='" + this.csGuiLabels["SimParamCountTip"]  + "' > ";
  csContent += "      <label >";
  csContent +=          this.csGuiLabels["SimParamCount"];
  csContent += "      </label>";
  csContent += "    </td>";
  csContent += "    <td id='CHS2_HuntParamHuntNbVal' style='line-height:20px; ' title='" + this.csGuiLabels["SimParamCountTip"]  + "' >";
  csContent += "      <input type='text' id='CHS2_HuntParamHuntNbInput' size='1' style='text-align:right;font-size:18px; ' value='0' disabled  />";
  csContent += "      <label style='margin-left:20px;'>";
  csContent += "        <input type='checkbox' id='CHS2_HuntParamHuntNbAutoCB' checked />";
  csContent += "        Auto";
  csContent += "      </label>";
  csContent += "    </td>";

  // Hunt amount input.
  csContent += "    <td id='CHS2_HuntParamHuntHFLabel' style='padding-left:40px; line-height:20px; ' title='" + this.csGuiLabels["SimParamAmountTip"]  + "' >";
  csContent += "      <label >";
  csContent +=          this.csGuiLabels["SimParamAmount"];
  csContent += "      </label>";
  csContent += "    </td>";
  csContent += "    <td id='CHS2_HuntParamHuntHFVal' style='line-height:20px; ' title='" + this.csGuiLabels["SimParamAmountTip"]  + "' >";
  csContent += "      <input type='text' id='CHS2_HuntParamHuntHFInput' size='20' style='text-align:right;font-size:18px;' value='0' disabled />";
  csContent += "      cm²";
  csContent += "      <label style='margin-left:20px;'>";
  csContent += "        <input type='checkbox' id='CHS2_HuntParamHuntHFAutoCB' checked />";
  csContent += "        Auto";
  csContent += "      </label>";
  csContent += "    </td>";
  csContent += "    </b>";
  csContent += "  </tr>";

  csContent += "</tbody></table>";
  csContent += "</div>";
  csContent += "<br/><hr/>";
  csContent += "<div id=CHS2_HuntDurationFrame style='color:grey;'> <br/>"
  csContent += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>TEMP : Calculatrice de TdC à chasser en fonction de la date de retour souhaitée...</i><br/>";
  csContent += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date d'arrivée souhaitée : ";
  csContent += "<input id='CHS2_datetimepicker' type='text' /> <i>(dd/mm/yyyy hh:MM, pas avant : <span id='CH2_datetimeMin'></span>)</i><br/>";
  csContent += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;---> quantité à chasser : <span id='CHS2_datetimeHF'> ? </span>";
  csContent += "</div>";
  csContent += "<br/><hr/>";

  //   #####  HTML : HUNT DETAILS  #####

  // Show/Hide simulation details div.
  csContent += "<a id='CHS2_DisplaySimDetails' style='padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplaySimDetails'> &#x25B2; " + this.csGuiLabels["HideSimDetails"] + " &#x25B2; </a> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";


  // Allow to copy hunt details.
  //csTemp = this.csGuiLabels["DetailsHF"] + " : " + oCHS2_util.Format(0, 0, " ");
  csContent += "<input id='CHS2_HuntDetailsList' style='border: none; background: transparent;' value='" + " " + "' size='40'> </input>";
  //csContent += "<button id='CHS2_HuntDetailsCopy' type='button' title ='Copy to clipboard'>Copy</button>";

  csContent += "<br/>";

  // Simulation details div.
  csContent += "<div id='CHS2_SimDetailsFrame' class='boite_amelioration' style='display:block;'>";
  csContent += "<br/>";
  csContent += "<table class='boite_amelioration' id='CHS2_SimDetailsTable' cellspacing='5'><tbody>";

  // Hunt amount, duration and ETA details.
  //csContent += "  <tr title=' " + this.csGuiLabels["DetailsHFAndTimeTip"] + "' >";
  // Hunt amount, duration and ETA details.
  csContent += "  <tr title=' " + this.csGuiLabels["DetailsHFAndTimeTip"] + "' >";
  csContent += "    <td>" + this.csGuiLabels["DetailsHF"] + "</td>";
  csContent += "    <td id='CHS2_DetailsHF' style='padding-right:30px;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "    <td>" + this.csGuiLabels["DetailsDuration"] + "</td>";
  csContent += "    <td id='CHS2_DetailsDuration' style='padding-right:30px;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "  </tr>";
  csContent += "  <tr title=' " + this.csGuiLabels["DetailsHFAndTimeTip"] + "' >";
  csContent += "    <td>" + this.csGuiLabels["DetailsCountAmount"] + "</td>";
  csContent += "    <td id='CHS2_DetailsCount&Amount' style='padding-right:30px;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "    <td>" + this.csGuiLabels["DetailsETA"] + "</td>";
  csContent += "    <td id='CHS2_DetailsETA' style='padding-right:30px; '>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "  <tr title=' " + this.csGuiLabels["DetailsHFAndTimeTip"] + "' >";
  csContent += "    <td>" + this.csGuiLabels["DetailsHFPerDay"] + "</td>";
  csContent += "    <td style='padding-right:30px; '>";
  csContent += "      <span id='CHS2_DetailsHFPerDay' style=''>";
  csContent +=          oCHS2_util.Format(0, 0, " ");
  csContent += "      </span>" + this.csGuiLabels["Detailscm2PerDay"];
  csContent += "    </td>";
  csContent += "    <td></td>";
  csContent += "    <td></td>";
  csContent += "  </tr>";

  csContent += "  <tr><td colspan='4'> &nbsp; </td></tr>";

  // Ratio, difficulty and food details.
  csContent += "  <tr>";
  csContent += "    <td title=' " + this.csGuiLabels["DetailsRatioTip"] + "' >";
  csContent +=        this.csGuiLabels["DetailsRatio"] + "</td>";
  csContent += "    <td id='CHS2_DetailsRatio' style='padding-right:30px;' title=' " + this.csGuiLabels["DetailsRatioTip"] + "' >";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "    <td title=' " + this.csGuiLabels["DetailsDifficultyTip"] + "' >";
  csContent +=        this.csGuiLabels["DetailsDifficulty"] + "</td>";
  csContent += "    <td id='CHS2_DetailsDifficulty' style='padding-right:30px;' title=' " + this.csGuiLabels["DetailsDifficultyTip"] + "' >";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "  </tr>";
  csContent += "  <tr>";
  csContent += "    <td title=' " + this.csGuiLabels["DetailsUsedRatioTip"] + "' >";
  csContent +=        this.csGuiLabels["DetailsUsedRatio"] + "</td>";
  csContent += "    <td id='CHS2_DetailsUsedRatio' style='padding-right:30px;' title=' " + this.csGuiLabels["DetailsUsedRatioTip"] + "' >";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "    <td title=' " + this.csGuiLabels["DetailsDifficultyTip"] + "' >";
  csContent +=        this.csGuiLabels["DetailsFood"] + "</td>";
  csContent += "    <td id='CHS2_DetailsFood' style='padding-right:30px;' title=' " + this.csGuiLabels["DetailsDifficultyTip"] + "' >";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "  </tr>";

  csContent += "  <tr><td colspan='4'> &nbsp; </td></tr>";

  // Losses estimation details.
  csContent += "  <tr title=' " + this.csGuiLabels["DetailsEstimationTip"] + "' >";
  csContent += "    <td><b>" + this.csGuiLabels["DetailsEstimation"] + "</b></td>";
  csContent += "    <td style='text-align:center;'>" + this.csGuiLabels["DetailsMin"] + "</td>";
  csContent += "    <td style='text-align:center;'><b>" + this.csGuiLabels["DetailsAvg"] + "</b></td>";
  csContent += "    <td style='text-align:center;'>" + this.csGuiLabels["DetailsMax"] + "</td>";
  csContent += "  </tr>";
  csContent += "  <tr title=' " + this.csGuiLabels["DetailsEstimationTip"] + "' >";
  csContent += "    <td>" + this.csGuiLabels["DetailsAsYD"] + "</td>";
  csContent += "    <td id='CHS2_DetailsMin' style='text-align:center;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "    <td id='CHS2_DetailsAvg' style='text-align:center;'><b>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</b></td>";
  csContent += "    <td id='CHS2_DetailsMax' style='text-align:center;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "  </tr>";
  csContent += "  <tr title=' " + this.csGuiLabels["DetailsEstimationTip"] + "' >";
  csContent += "    <td>" + this.csGuiLabels["DetailsAsTime"] + "</td>";
  csContent += "    <td id='CHS2_DetailsMinTime' style='text-align:center;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "    <td id='CHS2_DetailsAvgTime' style='text-align:center;'><b>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</b></td>";
  csContent += "    <td id='CHS2_DetailsMaxTime' style='text-align:center;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "  </tr>";
  csContent += "  <tr title=' " + this.csGuiLabels["DetailsEstimationTip"] + "' >";
  csContent += "    <td>" + this.csGuiLabels["DetailsAsRatio"] + "</td>";
  csContent += "    <td id='CHS2_DetailsMinRatio' style='text-align:center;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "    <td id='CHS2_DetailsAvgRatio' style='text-align:center;'><b>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</b></td>";
  csContent += "    <td id='CHS2_DetailsMaxRatio' style='text-align:center;'>";
  csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
  csContent += "  </tr>";

  csContent += "</tbody></table>";

  // Show/Hide Other HF losses div.
  csContent += "<div style='text-align:center;'><br/><hr/>";
  csContent += "  <a id='CHS2_DisplayOtherHF' style='padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplaySimDetails' title='" + this.csGuiLabels["OtherHFTipLabelTip"].replace("$HF", "0") + "'>"
  csContent += "    &#x25BC; " + this.csGuiLabels["OtherHFTipLabel"] + this.csGuiLabels["ShowOtherHF"] + " &#x25BC; ";
  csContent += "  </a>";
  csContent += "</div>";
  // Other HF losses div.
  csContent += "<div id='CHS2_OtherHFFrame' class='boite_amelioration' style='display:none; text-align:center; ' title=' " + this.csGuiLabels["OtherHFTip"] + "' >";
  csContent += "<br/>";
  csContent += "<table class='boite_amelioration tab_triable rowstyle-alt no-arrow sortable-onload-show-4r' id='CHS2_OtherHFTable' style='border-collapse: collapse' ><tbody>";
  csContent += "  <tr class='alt' style='color:#808080;' >";
  csContent += "    <td  style='color:black;'><b>" + this.csGuiLabels["DetailsEstimation"] + "</b></td>";
  csContent += "    <td style='text-align:center;	padding-left: 20px;'>";
  csContent += "      <span style='color:black;'>Total " + this.csGuiLabels["OtherHFHunt"] + "</span><br/>";
  csContent +=        this.csGuiLabels["DetailsMin"] + " / ";
  csContent += "      <span style='color:black;'><b>" + this.csGuiLabels["DetailsAvg"] + "</b></span> / ";
  csContent +=        this.csGuiLabels["DetailsMax"] + "<br/>";
  csContent += "      ratio (reference ratio) ";
  csContent += "    </td>";
  csContent += "    <td style='text-align:center;	padding-left: 20px;'><span style='color:black;'>" + this.csGuiLabels["OtherHFHunt"] + " N°";
  csContent += "      <select id='CHS2_OtherHFHuntSelect1' size='1'>";
  csContent += "        <option selected> 1 </option>";
  csContent += "      </select></span>";
  csContent += "      <br/><span style='color:black;'><b>" + this.csGuiLabels["DetailsAvg"] + "</span></b> / " + this.csGuiLabels["DetailsMax"];
  csContent += "      <br/>ratio (reference ratio)";
  csContent += "    </td>";
  csContent += "    <td style='text-align:center;	padding-left: 20px;'><span style='color:black;'>" + this.csGuiLabels["OtherHFHunt"] + " N°";
  csContent += "      <select id='CHS2_OtherHFHuntSelect2' size='1'>";
  csContent += "        <option selected> 1 </option>";
  csContent += "      </select></span>";
  csContent += "      <br/><span style='color:black;'><b>" + this.csGuiLabels["DetailsAvg"] + "</span></b> / " + this.csGuiLabels["DetailsMax"];
  csContent += "      <br/>ratio (reference ratio)";
  csContent += "    </td>";
  csContent += "  </tr>";
  for (var ohf = 0; ohf < this.nOtherHF.length; ohf++)
  {
    csContent += "  <tr id='CHS2_OtherHFTableRow" + ohf + "' " + ((ohf & 1) ? "class='alt'" : "") + " style='' >";
    csContent += "    <td>";
    csContent += "      <input type='text' id='CHS2_OtherHF" + ohf + "' ohf ='" + ohf + "' size='13' style='text-align:right;' value='"
                          + oCHS2_util.Format(this.nOtherHF[ohf], 0, " ") + "' /> cm²<span id='CHS2_OtherHFYourHunt" + ohf + "'></span>";
    csContent += "    </td>";
    csContent += "    <td id='CHS2_OtherHF" + ohf + "Total' style='text-align:center;	padding-left: 20px;'>";
    csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
    csContent += "    <td id='CHS2_OtherHF" + ohf + "Hunt1' style='text-align:center;	padding-left: 20px;'>";
    csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
    csContent += "    <td id='CHS2_OtherHF" + ohf + "Hunt2' style='text-align:center;	padding-left: 20px;'>";
    csContent +=        oCHS2_util.Format(0, 0, " ") + "</td>";
    csContent += "  </tr>";
  }
  csContent += "</tbody></table>";
  csContent += "</div>";
  csContent += "</div>";
  csContent += "<br/><hr/>";

  //   #####  HTML : HUNT LAUNCH  #####

  // Show/Hide simulation details div.
  csContent += "<div style='text-align:left;'>";
  csContent += "  <div style='float:left; width:35%;'>";
  csContent += "    <a id='CHS2_DisplaySimLaunch' style='padding-left:30px; text-decoration:underline; cursor:pointer; color:#660099;' name='CHS2_DisplaySimLaunch'> &#x25B2; " + this.csGuiLabels["HideSimLaunch"] + " &#x25B2; </a> <br/><br/>";
  csContent += "    <span id='CHS2_LaunchWarning' style='padding-left:30px; color:#ff0000; display:block; ' >" + this.csGuiLabels["LaunchWarning"] + "</span>";
  csContent += "  </div>";
  csContent += "  <div id='CHS2_HuntLaunchParamDiv' style='text-align:left; display:block; font-size:0.9em;'>";
  csContent += "    <table class='boite_amelioration' id='CHS2_HuntLaunchParamTable'><tbody>";
  csContent += "    <tr>";
  csContent += "      <td ><b>" + this.csGuiLabels["LaunchParamLabel"] + "</b></td>"; //rawspan='2'
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamSingleTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamSingle' checked /> " + this.csGuiLabels["LaunchParamSingle"];
  csContent += "      </td>";
  csContent += "    </tr>";
  csContent += "    <tr>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamNumTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamNum' checked /> " + this.csGuiLabels["LaunchParamNum"];
  csContent += "      </td>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamDiffTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamDiff' /> " + this.csGuiLabels["LaunchParamDiff"];
  csContent += "      </td>";
  csContent += "    </tr>";
  csContent += "    <tr>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamUnitsTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamUnits' /> " + this.csGuiLabels["LaunchParamUnits"] ;
  csContent += "      </td>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamAttTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamAtt' /> " + this.csGuiLabels["LaunchParamAtt"];
  csContent += "      </td>";
  csContent += "    </tr>";
  csContent += "    <tr>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamMaxLossTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamMaxLoss' /> " + this.csGuiLabels["LaunchParamMaxLoss"];
  csContent += "      </td>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamRatioTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamRatio' /> " + this.csGuiLabels["LaunchParamRatio"];
  csContent += "      </td>";
  csContent += "    </tr>";
  csContent += "    <tr>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamAvgLossTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamAvgLoss' /> " + this.csGuiLabels["LaunchParamAvgLoss"];
  csContent += "      </td>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamCompactTip"] + "' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamCompact' /> " + this.csGuiLabels["LaunchParamCompact"];
  csContent += "      </td>";
  csContent += "    </tr>";
  csContent += "    <tr>";
  csContent += "      <td title='" + this.csGuiLabels["LaunchParamOthLossTip"] + "' colspan='2' >";
  csContent += "        <input type='checkbox' id='CHS2_LaunchParamOthLoss' /> " + this.csGuiLabels["LaunchParamOthLoss"];
  csContent += "        <input type='text' id='CHS2_LaunchParamOthLossInput' size='15' style='text-align:right;' value='10 000 000' enabled />";
  csContent += "        cm²";
  csContent += "      </td>";
  csContent += "    </tr>";
  csContent += "    </tbody></table><br/>";
  csContent += "  </div>";
  csContent += "</div>";

  // Simulation launch div.
  csContent += "<div id='CHS2_SimLaunchFrame' class='boite_amelioration' style='display:block; font-size:0.9em; '>";

  csContent += "<table class='boite_amelioration' id='CHS2_SimLaunchTable' cellspacing='10'><tbody>";
  csContent += "  <tr>";
  csContent += "    <td>";
  csContent += "    </td>";
  csContent += "  </tr>";
  // Hunt launch details contener
  csContent += "<div id='CHS2_HuntLaunchDetails'></div>";

  csContent += "</tbody></table>";

  // Launch = function(nHunt, securiteN, securiteV)
  csContent += "<div style='text-align:center; '>";
  csContent += "  <button id='CHS2_LaunchBtn' type='button' style='font-size:125%; '>";
  csContent +=      "<b><img src='images/icone/icone_degat_attaque.gif'> &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;";
  csContent +=      this.csGuiLabels["LaunchALL"];
  csContent +=      " &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; <img src='images/icone/icone_degat_attaque.gif'></b>";
  csContent += "  </button>";
  csContent += "</div>";

  csContent += "</div>";
  csContent += "<br/><br/>";

  csContent += "</div>";
  csContent += "</div>";

  //   #####  HTML : APPEND HTML.  #####

  // Append HTML to Resources page.
  $("#centre").append(csContent);

  //   #####  GUI behaviour : SIMULATOR.  #####

  // Show / Hide simulator & revision history + import.
  GEBI("CHS2_DisplaySimulator").onclick = function() { oCHS2_simu.ToggleSubByID("CHS2_SimultorDiv", "CHS2_DisplaySimulator"); };

  GEBI("CHS2_DisplayHistory").onclick   = function() { oCHS2_simu.ToggleSubByID("CHS2_HistoryDiv", "CHS2_DisplayHistory"); };

  GEBI("CHS2_DisplayImport").onclick    = function() { oCHS2_simu.ToggleSubByID("CHS2_ImportDiv", "CHS2_DisplayImport"); };

  //   #####  GUI behaviour : USER DATA.  #####

  // Show / Hide user datas
  GEBI("CHS2_DisplayUserData").onclick = function() { oCHS2_simu.ToggleSubByID("CHS2_UserDataFrame", "CHS2_DisplayUserData"); };
  //  Retrieve/Refresh button click event.
  GEBI("CHS2_InputTableRetrieve").onclick = function() { oCHS2_simu.UpdateUserData(); };
  // Building and techno change event.
  for (i = 0; i < this.usedTechno.length; i++)
  {
    csTemp = "CHS2_InputTable" + this.usedTechno[i] + "Input";
    GEBI(csTemp).onkeyup = function()
    {
      oCHS2_simu.checkData(this.id);
      oCHS2_simu.ComputeUserParam();
    };
    GEBI(csTemp).onchange = function()
    {
      oCHS2_simu.checkData(this.id);
      oCHS2_simu.ComputeUserParam();
    };
  }
  // Army change event.
  for (i = 1; i < oCHS2_data.csUnitNamesDisplay.length; i++)
  {
    csTemp = "CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[i]) + "Input";
    GEBI(csTemp).onkeyup = function()
    {
      oCHS2_simu.checkData(this.id);
      oCHS2_simu.ComputeUserParam();
    };
    GEBI(csTemp).onchange = function()
    {
      oCHS2_simu.checkData(this.id);
      oCHS2_simu.ComputeUserParam();
    };
  }
  // Import Army events.
  GEBI("CHS2_ImportCmd").onclick = function()
  {
    var csTemp = "";
    var sRawText = document.getElementById("CHS2_ImportRawDatas").value;

    // Update Raw import text.
    var oValues = oCHS2_import.Split(sRawText);
    var sOutput = "";
    for (var i = 0; i < oValues.length; i++)
    {
      sOutput += oValues[i] + "\n";
    }
    document.getElementById("CHS2_ImportRawDatas").value = sOutput;

    // Update army unit count.
    var oUnits = oCHS2_import.ParseData(sRawText);
    for (var iUnit = 0; iUnit < oUnits["Names"].length; iUnit++)
    {
      csTemp = "CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[iUnit + 1]) + "Input";
      //sOutput += csTemp + "\n";
      GEBI(csTemp).value = oCHS2_util.Format(oUnits["Count"][iUnit], 0, " ");
      oCHS2_simu.checkData(GEBI(csTemp).id);
    }
    //document.getElementById("CHS2_ImportRawDatas").value = sOutput;
    oCHS2_simu.ComputeUserParam();
  };
  //   #####  GUI behaviour : HUNT PARAM.  #####

  // Show/Hide hunt params.
  GEBI("CHS2_DisplaySimParam").onclick = function()  { oCHS2_simu.ToggleSubByID("CHS2_SimParamFrame", "CHS2_DisplaySimParam");  };
  // Launch HF change event.
  GEBI("CHS2_InputLaunchHFValInput").onkeyup = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.nBaseHF = parseInt(oCHS2_util.RemoveAllSpaces(this.value));
    oCHS2_simu.ComputeUserParam();
  };
  GEBI("CHS2_InputLaunchHFValInput").onchange = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.nBaseHF = parseInt(oCHS2_util.RemoveAllSpaces(this.value));
    oCHS2_simu.ComputeUserParam();
  };
  // End HF change event.
  GEBI("CHS2_InputEndHFValInput").onkeyup = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.nEndHF = parseInt(oCHS2_util.RemoveAllSpaces(this.value));
    oCHS2_simu.ComputeUserParam();
  };
  GEBI("CHS2_InputEndHFValInput").onchange = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.nEndHF = parseInt(oCHS2_util.RemoveAllSpaces(this.value));
    oCHS2_simu.ComputeUserParam();
  };
  //  Ratio selection change event.
  GEBI("CHS2_HuntParamBaseRatioSelect").onchange = function()
  {
    this.style.background = oCHS2_simu.csHuntsRatiosBGcolors[this.selectedIndex];
    this.style.color      = oCHS2_simu.csHuntsRatiosColors[this.selectedIndex];
    oCHS2_simu.nSelectedRefRatioIndex = this.selectedIndex;
    if (oCHS2_simu.bRatioManualChange)
    {
      oCHS2_simu.bRatioManualChange = false;
      oCHS2_simu.ComputeHuntParameters();
    }
  };
  // To know when ratio is changed by user or by simulator
  GEBI("CHS2_HuntParamBaseRatioSelect").onclick = function()
  {
    oCHS2_simu.bRatioManualChange = true;
  };
  // Hunt count change event.
  GEBI("CHS2_HuntParamHuntNbInput").onchange  = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.ComputeHuntCountAmount();
  };
  GEBI("CHS2_HuntParamHuntNbInput").onkeyup   = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.ComputeHuntCountAmount();
  };
  GEBI("CHS2_HuntParamHuntNbAutoCB").onchange = function()
  {
    GEBI("CHS2_HuntParamHuntNbInput").disabled = this.checked;
    oCHS2_simu.ComputeHuntCountAmount();
 };

  // Hunt amount change event.
  GEBI("CHS2_HuntParamHuntHFInput").onchange  = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.ComputeHuntCountAmount();
  };
  GEBI("CHS2_HuntParamHuntHFInput").onkeyup   = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.ComputeHuntCountAmount();
  };
  GEBI("CHS2_HuntParamHuntHFAutoCB").onchange = function()
  {
    GEBI("CHS2_HuntParamHuntHFInput").disabled = this.checked;
    oCHS2_simu.ComputeHuntCountAmount();
  };

  // Compute hunt amount from return date.
  GEBI("CHS2_datetimepicker").onchange = function()
  {
    var nCurHF    = oCHS2_simu.nBaseHF;
    var nAmount   = 0;
    var nVC       = oCHS2_simu.nUsedLevels["HuntSpeed"];
    var oCurDate  = new Date();
    var oWishDate = new Date();
    var oMinDate  = new Date(oCurDate.getTime() + Math.ceil(nCurHF * ((nVC == 0) ? 1 : Math.pow(0.9, nVC)) * 1000));
    var sVal      = this.value;
    if (new RegExp("([0-9][0-9]).([0-9][0-9]).([0-9][0-9][0-9][0-9]).([0-9][0-9]).([0-9][0-9])", "g").test(sVal))
    {
      var oVal = (new RegExp("([0-9][0-9]).([0-9][0-9]).([0-9][0-9][0-9][0-9]).([0-9][0-9]).([0-9][0-9])", "g").exec(sVal))
      oWishDate = new Date(oVal[3], oVal[2]-1, oVal[1], oVal[4], oVal[5], 0, 0);
      if (oWishDate.getTime() > oMinDate.getTime())
      {
        nAmount = (((oWishDate.getTime() - oCurDate.getTime()) / 1000) / ((nVC == 0) ? 1 : Math.pow(0.9, nVC))) - nCurHF;
        sVal = oCHS2_util.Format(nAmount, 0, " ") + " cm²";
      }
      else
      {
        sVal = "Avec un TdC de départ de " + oCHS2_util.Format(nCurHF, 0, " ") + "cm² vous ne pouvez pas rentrer avant cette date : " + oMinDate.toLocaleString() + " alors que vous avez demandé à rentrer le " + oWishDate.toLocaleString();
      }
    }
    else
    {
      sVal = "date non valide";
    }
    GEBI("CHS2_datetimeHF").innerHTML = sVal;
  };
  //   #####  GUI behaviour : HUNT DETAILS.  #####

  // Show/Hide hunt details.
  GEBI("CHS2_DisplaySimDetails").onclick = function() { oCHS2_simu.ToggleSubByID("CHS2_SimDetailsFrame", "CHS2_DisplaySimDetails"); };

  // Show/Hide other HF losses.
  GEBI("CHS2_DisplayOtherHF").onclick = function() { oCHS2_simu.ToggleSubByID("CHS2_OtherHFFrame", "CHS2_DisplayOtherHF"); };

  // Other HF input changes.
  for (var ohf = 0; ohf < this.nOtherHF.length; ohf++)
  {
    GEBI("CHS2_OtherHF" + ohf).onkeyup = function()
    {
      var ohf = parseInt(this.attributes.ohf.value); //(new RegExp("[0-9]", "g").test(this.id)) ? (new RegExp("[0-9]", "g").exec(this.id)) : 0;
      oCHS2_simu.checkData(this.id);
      oCHS2_simu.RefreshOtherHF(ohf);
    };
    GEBI("CHS2_OtherHF" + ohf).onchange = function()
    {
      var ohf = parseInt(this.attributes.ohf.value); //(new RegExp("[0-9]", "g").test(this.id)) ? (new RegExp("[0-9]", "g").exec(this.id)) : 0;
      oCHS2_simu.checkData(this.id);
      oCHS2_simu.RefreshOtherHF(ohf);
    };
  }

  // First line is for user current hunt
  GEBI("CHS2_OtherHF0").disabled = true;
  GEBI("CHS2_OtherHFTableRow0").style.color = "#400080";
  GEBI("CHS2_OtherHFYourHunt0").innerHTML = this.csGuiLabels["OtherHFHuntYourHF"];

  // Other HF select hunt change.
  GEBI("CHS2_OtherHFHuntSelect1").onchange = function() { for (var ohf = 0; ohf < oCHS2_simu.nOtherHF.length; ohf++) { oCHS2_simu.RefreshOtherHF(ohf); } };
  GEBI("CHS2_OtherHFHuntSelect2").onchange = function() { for (var ohf = 0; ohf < oCHS2_simu.nOtherHF.length; ohf++) { oCHS2_simu.RefreshOtherHF(ohf); } };

  //   #####  GUI behaviour : HUNT LAUNCH  #####

  // Show/Hide hunt launch.
  GEBI("CHS2_DisplaySimLaunch").onclick = function()
  {
    oCHS2_simu.ToggleSubByID("CHS2_SimLaunchFrame", "CHS2_DisplaySimLaunch");
    oCHS2_simu.ToggleSubByID("CHS2_HuntLaunchParamDiv", "");
    oCHS2_simu.ToggleSubByID("CHS2_LaunchWarning", "");
  };

  // Launch = function(nHunt, securiteN, securiteV)
  GEBI("CHS2_LaunchBtn").onclick = function()
  {
    oCHS2_simu.Launch(oCHS2_simu.nFirstHuntToLaunch, oCHS2_simu.nHuntCount, "", "", true);
  }

  // Other HF in launch param.
  GEBI("CHS2_LaunchParamOthLossInput").onkeyup = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.RefreshLaunchOtherHF(parseInt(oCHS2_util.RemoveAllSpaces(this.value)));
  };
  GEBI("CHS2_LaunchParamOthLossInput").onchange = function()
  {
    oCHS2_simu.checkData(this.id);
    oCHS2_simu.RefreshLaunchOtherHF(parseInt(oCHS2_util.RemoveAllSpaces(this.value)));
  };

  //   #####  GUI INITIALISATION.  #####

  // Retrieve user data >>> compute user data >>> compute hunts
  this.UpdateUserData();

};

// ________________________________________________________________________________
// Check input data and formats.
// (integer values : check for only numbers and format with thousand separator)
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.checkData = function(asId)
{
  try
  {
    var sValue = oCHS2_util.RemoveAllSpaces(GEBI(asId).value);
    var iValue = (isNaN(sValue) || sValue == "") ? 0 : parseInt(sValue);
    GEBI(asId).value = oCHS2_util.Format(iValue, 0, " ");
    return iValue;
  }
  catch (err)
  {
    alert("CHS2_Simu.checkData(" + asId + ") error : " + err);
  }
};

// ________________________________________________________________________________
// Hide / Show Subdivisions of document.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ToggleSubByID = function(divID, labelID)
{
  // Show/Hide Div
  var bWasDisplayed = (document.getElementById(divID).style.display == "block");
  GEBI(divID).style.display = bWasDisplayed ? "none" : "block";

  // Update label if any ( If you don't want to change label give an empty string as label ID).
  if (labelID.length > 0)
  {
    var sLabel = GEBI(labelID).innerHTML;
    if (bWasDisplayed)
    {
      sLabel = sLabel.replace(oCHS2_simu.csGuiLabels["HideFR"], oCHS2_simu.csGuiLabels["ShowFR"]);
      sLabel = sLabel.replace(oCHS2_simu.csGuiLabels["HideKR"], oCHS2_simu.csGuiLabels["ShowKR"]);
      sLabel = sLabel.replace(oCHS2_simu.csGuiLabels["HideEN"], oCHS2_simu.csGuiLabels["ShowEN"]);
      sLabel = sLabel.replace(new RegExp("\u25B2", "g"), "\u25BC");
    } else
    {
      sLabel = sLabel.replace(oCHS2_simu.csGuiLabels["ShowFR"], oCHS2_simu.csGuiLabels["HideFR"]);
      sLabel = sLabel.replace(oCHS2_simu.csGuiLabels["ShowKR"], oCHS2_simu.csGuiLabels["HideKR"]);
      sLabel = sLabel.replace(oCHS2_simu.csGuiLabels["ShowEN"], oCHS2_simu.csGuiLabels["HideEN"]);
      sLabel = sLabel.replace(new RegExp("\u25BC", "g"), "\u25B2");
    }
    GEBI(labelID).innerHTML = sLabel;
  }
};

// ________________________________________________________________________________
// Update / retrieve user data.
// Called at start or when retrieve/refresh button is clicked.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.UpdateUserData = function()
{
  // Retrieve game user data.
  oCHS2_data.getGameData();

  // set ratio default value
  //this.nSelectedRefRatioIndex = 9;

  // Update stored building and techno levels.
  this.nUsedLevels["Weapon"]                 = oCHS2_data.nTechnoLevels[2];
  this.nUsedLevels["Incubator"]              = oCHS2_data.nBuildingLevels[3];
  this.nUsedLevels["Shield"]                 = oCHS2_data.nTechnoLevels[1];
  this.nUsedLevels["Solarium"]               = oCHS2_data.nBuildingLevels[4];
  this.nUsedLevels["HuntSpeed"]              = oCHS2_data.nTechnoLevels[5];
  this.nUsedLevels["LayingDevice"]           = oCHS2_data.nTechnoLevels[0];
  // Update building and techno level display.
  for (var i = 0; i < this.usedTechno.length; i++)
  {
    GEBI("CHS2_InputTable" + this.usedTechno[i] + "Input").value = oCHS2_util.Format(this.nUsedLevels[this.usedTechno[i]], 0, " ");
  }

  // Update Army stored data and display.
  for (var i = 1; i < oCHS2_data.csUnitNamesDisplay.length; i++)
  {
    this.nUserUsedUnits[i] = oCHS2_data.nUserUnits[i];
    GEBI("CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[i]) + "Input").value = oCHS2_util.Format(this.nUserUsedUnits[i], 0, " ");
    GEBI("CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[i]) + "Comment").innerHTML = " (" + oCHS2_util.Format(oCHS2_data.nUserUnits[i], 0, " ") + " Max)";
  }

  // Update HF stored data and display.
  this.nBaseHF = oCHS2_data.nHF;
  this.nEndHF = oCHS2_data.nHF;
  GEBI("CHS2_InputLaunchHFValInput").value = oCHS2_util.Format(this.nBaseHF, 0, " ");
  GEBI("CHS2_InputEndHFValInput").value = oCHS2_util.Format(this.nEndHF, 0, " ");

  // Compute army.
  this.ComputeUserParam();
};

// ________________________________________________________________________________
// Compute player parameters.
// Called after user parameters update or changes.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeUserParam = function()
{
  //try
  {
    var i = 0;
    var csTemp = "";
    // Read and store building and techno datas.
    for (i = 0; i < this.usedTechno.length; i++)
    {
      csTemp = "CHS2_InputTable" + this.usedTechno[i] + "Input";
      this.nUsedLevels[this.usedTechno[i]] = parseInt(oCHS2_util.RemoveAllSpaces(GEBI(csTemp).value));
    }
    // Read and store army data.
    this.nPlayerArmyBaseAtt = 0;
    for (i = 1; i < oCHS2_data.csUnitNamesDisplay.length; i++)
    {
      csTemp = "CHS2_InputArmy" + oCHS2_util.RemoveAllSpaces(oCHS2_data.csUnitNamesDisplay[i]) + "Input";
      this.nUserUsedUnits[i] = parseInt(oCHS2_util.RemoveAllSpaces(GEBI(csTemp).value));
      this.nPlayerArmyBaseAtt += (this.nUserUsedUnits[i] * oCHS2_data.nUnitsBaseAtt[i]);
    }
    // Compute Army attack with weapon bonus.
    this.nPlayerArmyAtt = (this.nPlayerArmyBaseAtt + (this.nPlayerArmyBaseAtt * this.nUsedLevels["Weapon"] / 10));
    GEBI("CHS2_ArmyAtt").innerHTML = "(Att = " + oCHS2_util.Format(this.nPlayerArmyAtt, 0, " ") + ")";

    // Compute hunts.
    this.ComputeHuntParameters();
  }
  /*catch (err)
  {
    alert("CHS2_Simu.ComputeUserParam() error : " + err);
  }*/
};

// ________________________________________________________________________________
// Refresh hunts.
// Called after user parameters computation or hunt parameters changes.
// (except manual count and amount settings).
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeHuntParameters = function()
{
  if (this.nEndHF == 0) this.nEndHF = 1;
  if (this.nBaseHF == 0) this.nBaseHF = 1;
  //try
  {
    // Compure ratios and refresh ratio select list.
    this.ComputeRatiosLabels(this.nPlayerArmyAtt, this.nUsedLevels["HuntSpeed"], this.nEndHF, Math.round(this.nBaseHF / 4), this.nUsedLevels["Shield"]);
    for (var i = 0; i < this.dHuntsRatiosValues.length; i++)
    {
      GEBI("CHS2_HuntParamBaseRatioSelect").options[i].innerHTML  = this.csHuntsRatiosLabels[i];
      GEBI("CHS2_HuntParamBaseRatioSelect").options[i].title      = this.csHuntsRatioTips[i];
    }
    GEBI("CHS2_HuntParamBaseRatioSelect").title = this.csGuiLabels["SimParamRatioTip"] + "\n\n" + this.csHuntsRatioTips[GEBI("CHS2_HuntParamBaseRatioSelect").selectedIndex];

    // Initialise / refresh hunt count and amount.
    GEBI("CHS2_HuntParamHuntNbInput").value = oCHS2_util.Format(this.nHuntCount, 0, " ");
    GEBI("CHS2_HuntParamHuntHFInput").value = oCHS2_util.Format(this.nHuntAmount, 0, " ");

    this.ComputeHuntCountAmount();
  }
  /*catch (err)
  {
    alert("CHS2_Simu.ComputeHuntParameters() error : " + err);
  }*/
};

// ________________________________________________________________________________
// Hunt count and amount change
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeHuntCountAmount = function()
{
  //try
  {

    this.nHuntCount = parseInt(oCHS2_util.RemoveAllSpaces(GEBI("CHS2_HuntParamHuntNbInput").value));
    this.nHuntAmount = parseInt(oCHS2_util.RemoveAllSpaces(GEBI("CHS2_HuntParamHuntHFInput").value));
    var nCount = GEBI("CHS2_HuntParamHuntNbAutoCB").checked ? 0 : this.nHuntCount;
    var nAmount = GEBI("CHS2_HuntParamHuntHFAutoCB").checked ? 0 : this.nHuntAmount;

    var oHunts = this.ComputeHunts(this.dHuntsRatiosValues[this.nSelectedRefRatioIndex], this.nPlayerArmyAtt, this.nUsedLevels["HuntSpeed"] , this.nEndHF, Math.round(this.nBaseHF / 4), nCount, nAmount);

    if (nCount == 0)
    {
      this.nHuntCount = oHunts["NB"];
      GEBI("CHS2_HuntParamHuntNbInput").value = oCHS2_util.Format(oHunts["NB"], 0, " ");
    }
    if (nAmount == 0)
    {
      this.nHuntAmount = oHunts["HF"];
      GEBI("CHS2_HuntParamHuntHFInput").value = oCHS2_util.Format(oHunts["HF"], 0, " ");
    }

    this.RefreshDetails();
  }
  /*catch (err)
  {
    alert("CHS2_Simu.ComputeHuntParameters() error : " + err);
  }*/
};

// ________________________________________________________________________________
// Refresh details.
// Called after user parameters computation or hunt parameters changes.
// (Including manual count and amount settings).
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.RefreshDetails = function()
{
  //try
  {
    var formatDuration = function(p_nTime)
    {
      var nDay        = Math.floor(p_nTime / 86400);
      var nHour       = Math.floor((p_nTime - nDay * 86400) / 3600);
      var nMinutes    = Math.floor((p_nTime - nDay * 86400 - nHour * 3600) / 60);
      var csDuration  = oCHS2_simu.csGuiLabels["DisplayDuration"];
      csDuration      = csDuration.replace("$day", nDay);
      csDuration      = csDuration.replace("$hour", (nHour < 10 ? ("0" + nHour) : nHour));
      csDuration      = csDuration.replace("$min", (nMinutes < 10 ? ("0" + nMinutes) : nMinutes));
      return csDuration;
    }

    // Compute min return date.
      GEBI("CH2_datetimeMin").innerHTML = (new Date((new Date()).getTime() + Math.ceil(oCHS2_simu.nBaseHF * ((oCHS2_simu.nUsedLevels["HuntSpeed"] == 0) ? 1 : Math.pow(0.9, oCHS2_simu.nUsedLevels["HuntSpeed"])) * 1000))).toLocaleString();
    // Compute difficulty, ratio and losses.
    this.nDifficulty    = this.ComputeDifficulty(this.nEndHF, this.nHuntAmount, this.nHuntCount);
    this.nRealRatio     = this.nPlayerArmyAtt / this.nDifficulty;
    this.nRefRatioIndex = this.getRefRatioIndex(this.nRealRatio);
    // Update ratio select state.
    GEBI("CHS2_HuntParamBaseRatioSelect").selectedIndex     = this.nRefRatioIndex;
    GEBI("CHS2_HuntParamBaseRatioSelect").style.background  = this.csHuntsRatiosBGcolors[this.nRefRatioIndex];
    GEBI("CHS2_HuntParamBaseRatioSelect").style.color       = this.csHuntsRatiosColors[this.nRefRatioIndex];
    this.nSelectedRefRatioIndex                             = this.nRefRatioIndex;

    this.nLosses = this.ComputeLosses(this.nRefRatioIndex, this.nDifficulty, this.nUsedLevels["Shield"]);
    var nLayingLevel = this.nUsedLevels["Incubator"] + this.nUsedLevels["Solarium"] + this.nUsedLevels["LayingDevice"];

    // Compute hunt duration and ETA.
    var nDuration   = Math.round((this.nHuntAmount + this.nBaseHF) * Math.pow(0.9, this.nUsedLevels["HuntSpeed"]));
    var csDuration  = formatDuration(nDuration);
    var dateETA     = new Date();
    dateETA.setMilliseconds(dateETA.getMilliseconds() + 1000 * nDuration);
    var csDate = oCHS2_util.DateToString(dateETA, "%dddd% %dd% %mmm% %yyyy% - %HH% h %MM%", oCHS2_data.csLang == "FR" ? 0 : 1);

    // Update hunt amount details.
    GEBI("CHS2_DetailsHF").innerHTML           = oCHS2_util.Format(this.nHuntCount * this.nHuntAmount, 0, " ") + " cm²";
    GEBI("CHS2_DetailsCount&Amount").innerHTML = oCHS2_util.Format(this.nHuntCount, 0, " ") + " x " + oCHS2_util.Format(this.nHuntAmount, 0, " ") + " cm²";

    // Update hunt duration and ETA details.
    GEBI("CHS2_DetailsDuration").innerHTML  = csDuration;
    GEBI("CHS2_DetailsETA").innerHTML       = csDate;

    // Hunt efficiency.
    GEBI("CHS2_DetailsHFPerDay").innerHTML  = oCHS2_util.Format((this.nHuntCount * this.nHuntAmount) / (nDuration / 86400), 0, " ");

    // Update ratio details.
    GEBI("CHS2_DetailsRatio").innerHTML     = oCHS2_util.Format(this.nRealRatio, 2, " ");
    GEBI("CHS2_DetailsUsedRatio").innerHTML = oCHS2_util.Format(this.dHuntsRatiosValues[this.nRefRatioIndex], 1, " ");

    // Update difficulty and food details.
    GEBI("CHS2_DetailsDifficulty").innerHTML = oCHS2_util.Format(this.nDifficulty, 0, " ");
    GEBI("CHS2_DetailsFood").innerHTML       = oCHS2_util.Format(this.nDifficulty * 0.8, 0, " ");

    // Update losses details.
    var nTime = Math.round((this.nLosses["MIN"] * oCHS2_data.nUnitsLayingTimes[1]) * Math.pow(0.9, nLayingLevel));
    GEBI("CHS2_DetailsMin").innerHTML       = oCHS2_util.Format(this.nLosses["MIN"], 0, " ");
    GEBI("CHS2_DetailsMinTime").innerHTML   = formatDuration(nTime);
    GEBI("CHS2_DetailsMinRatio").innerHTML  = oCHS2_util.Format(nTime / nDuration * 100, 2, " ") + " %";
    nTime = Math.round((this.nLosses["AVG"] * oCHS2_data.nUnitsLayingTimes[1]) * Math.pow(0.9, nLayingLevel));
    GEBI("CHS2_DetailsAvg").innerHTML       = "<b>" + oCHS2_util.Format(this.nLosses["AVG"], 0, " ") + "</b>";
    GEBI("CHS2_DetailsAvgTime").innerHTML   = "<b>" + formatDuration(nTime) + "</b>";
    GEBI("CHS2_DetailsAvgRatio").innerHTML  = "<b>" + oCHS2_util.Format(nTime / nDuration * 100, 2, " ") + " %" + "</b>";
    nTime = Math.round((this.nLosses["MAX"] * oCHS2_data.nUnitsLayingTimes[1]) * Math.pow(0.9, nLayingLevel));
    GEBI("CHS2_DetailsMax").innerHTML       = oCHS2_util.Format(this.nLosses["MAX"], 0, " ");
    GEBI("CHS2_DetailsMaxTime").innerHTML   = formatDuration(nTime);
    GEBI("CHS2_DetailsMaxRatio").innerHTML  = oCHS2_util.Format(nTime / nDuration * 100, 2, " ") + " %";

    // Other HF losses.
    GEBI("CHS2_DisplayOtherHF").title   =  this.csGuiLabels["OtherHFTipLabelTip"].replace("$HF", oCHS2_util.Format(this.nEndHF, 0, " "));
    GEBI("CHS2_OtherHF0").value         = oCHS2_util.Format(this.nEndHF, 0, " ");
    // Refresh Other HF losses hunt N° selector list.
    while (GEBI("CHS2_OtherHFHuntSelect1").options.length > 0) { GEBI("CHS2_OtherHFHuntSelect1").remove(0); }
    while (GEBI("CHS2_OtherHFHuntSelect2").options.length > 0) { GEBI("CHS2_OtherHFHuntSelect2").remove(0); }
    for (var j = 1; j <= this.nHuntCount; j++)
    {
      // First select set on first hunt.
      var opt1        = document.createElement('option');
      opt1.value      = j;
      opt1.innerHTML  = j;
      opt1.selected   = (j == 1);
      GEBI("CHS2_OtherHFHuntSelect1").appendChild(opt1);
      // Second select set on last hunt.
      var opt2        = document.createElement('option');
      opt2.value      = j;
      opt2.innerHTML  = j;
      opt2.selected   = (j == this.nHuntCount);
      GEBI("CHS2_OtherHFHuntSelect2").appendChild(opt2);
    }
    // Fill table lines.
    for (var ohf = 0; ohf < this.nOtherHF.length; ohf++) { this.RefreshOtherHF(ohf); }

    this.ComputeHuntDispatch();
    this.DisplayLauch();
  }
  /*catch (err)
  {
    alert("CHS2_Simu.RefreshDetails() error : " + err);
  }*/
};

// ________________________________________________________________________________
// Compute base HF variation impact on hunts.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.RefreshOtherHF = function(ohf)
{
  var oHuntData;
  var nHunt                        = 0;
  var nVar                         = 0;
  var csContent                    = "";
  var oSumData                     = { "MIN" : 0, "AVG" : 0, "MAX" : 0, "VarMIN" : "", "VarAVG" : "", "VarMAX" : "" };
  var nNewBaseHF                   = parseInt(oCHS2_util.RemoveAllSpaces(GEBI("CHS2_OtherHF" + ohf).value));
  var nNewDifficulty               = this.ComputeDifficulty(nNewBaseHF, this.nHuntAmount, this.nHuntCount);
  var nNewRealRatio                = this.nPlayerArmyAtt / nNewDifficulty;
  var nNewRefRatioIndex            = this.getRefRatioIndex(nNewRealRatio);
  var nNewLossesIfRatioWasConstant = this.ComputeLosses(nNewRefRatioIndex, nNewDifficulty, this.nUsedLevels["Shield"]);
  // Ratio change from one hunt to another, so each hunt losses must be recomputed and results added.
  for (var nHunt = 1; nHunt <= this.nHuntCount; nHunt++)
  {
    oHuntData = this.getOtherHFSingleHunt(nHunt, nNewBaseHF);
    oSumData["MIN"] += oHuntData["MIN"];
    oSumData["AVG"] += oHuntData["AVG"];
    oSumData["MAX"] += oHuntData["MAX"];
  }
  // Compute losses variation...
  oSumData["VarMIN"]  = (oSumData["MIN"] - this.nLosses["MIN"]) / this.nLosses["MIN"];
  oSumData["VarAVG"]  = (oSumData["AVG"] - this.nLosses["AVG"]) / this.nLosses["AVG"];
  oSumData["VarMAX"]  = (oSumData["MAX"] - this.nLosses["MAX"]) / this.nLosses["MAX"];
  // ...and convert to string. (0.102789 -> "+ 10  %")
  oSumData["VarMIN"]  = (oSumData["VarMIN"] >= 0 ? "+ " : "- ") + oCHS2_util.Format(Math.abs(oSumData["VarMIN"] * 100), 0, " ") + " %";
  oSumData["VarAVG"]  = (oSumData["VarAVG"] >= 0 ? "+ " : "- ") + oCHS2_util.Format(Math.abs(oSumData["VarAVG"] * 100), 0, " ") + " %";
  oSumData["VarMAX"]  = (oSumData["VarMAX"] >= 0 ? "+ " : "- ") + oCHS2_util.Format(Math.abs(oSumData["VarMAX"] * 100), 0, " ") + " %";
  // Display Style.
  var grayed = function(p_n0, p_cs) { return "<span style='color:" + (p_n0 > 0 ? "#808080;'>" : "#A080FF;'>") + p_cs + "</span>"; };
  // Display data.
  GEBI("CHS2_OtherHF" + ohf + "Total").innerHTML =
      grayed(ohf, oCHS2_util.Format(oSumData["MIN"], 0, " ") + " / ")
    + "<b>" + oCHS2_util.Format(oSumData["AVG"], 0, " ") + "</b>"
    + grayed(ohf, " / " + oCHS2_util.Format(oSumData["MAX"], 0, " ")) + "<br/>"
    + (ohf == 0 ? "" : "<i>" + grayed(ohf, "(" + oSumData["VarMIN"] + " / ")
                       + "<b>" +  oSumData["VarAVG"] + "</b>"
                       + grayed(ohf, " / " + oSumData["VarMAX"] + ")") + "</i><br/>")
    + grayed(ohf, "ratio : " + oCHS2_util.Format(nNewRealRatio, 2, " ") + " (ref : " + oCHS2_util.Format(this.dHuntsRatiosValues[nNewRefRatioIndex], 1, " ") + ")");

  // Single hunt compute.
  for (var n = 1; n < 3; n++)
  {
    nHunt     = GEBI("CHS2_OtherHFHuntSelect" + n).selectedIndex + 1;
    oHuntData = this.getOtherHFSingleHunt(nHunt, nNewBaseHF);
    // Convert losses variation to string. (0.102789 -> "+ 10  %")
    oHuntData["VarAVG"] = (oHuntData["VarAVG"] >= 0 ? "+ " : "- ") + oCHS2_util.Format(Math.abs(oHuntData["VarAVG"] * 100), 0, " ") + " %";
    oHuntData["VarMAX"] = (oHuntData["VarMAX"] >= 0 ? "+ " : "- ") + oCHS2_util.Format(Math.abs(oHuntData["VarMAX"] * 100), 0, " ") + " %";
    // Display data.
    GEBI("CHS2_OtherHF" + ohf + "Hunt" + n).innerHTML =
      "<b>" + oCHS2_util.Format(oHuntData["AVG"], 0, " ") + "</b>"
      + grayed(ohf, " / " + oCHS2_util.Format(oHuntData["MAX"], 0, " ")) + "<br/>"
      + (ohf <= 0 ? "" : "<i>" + grayed(ohf, "(") + "<b>" +  oHuntData["VarAVG"] + "</b>" + grayed(ohf, " / " + oHuntData["VarMAX"] + ")") + "</i><br/>")
      + grayed(ohf, "ratio : " + oCHS2_util.Format(oHuntData["RealRatio"], 2, " ") + " (ref :" + oCHS2_util.Format(oHuntData["RefRatio"], 2, " ") + ")");
  }
}

// ________________________________________________________________________________
// Compute base HF variation impact on one hunt.
// Previous : current simulation parameters (including end HF).
// New : the hunt as they are computed and army dispatched for current simulation, but with a different HF than expected when hunts return.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.getOtherHFSingleHunt = function(p_nHuntNum, p_nNewBaseHF)
{
  // New difficulty for this hunt.
  var nNewHuntDiff          = this.ComputeSingleDifficulty(p_nNewBaseHF + (this.nHuntAmount * (p_nHuntNum - 1)), this.nHuntAmount);
  // Previous difficulty for this hunt.
  var nPreviousHuntDiff     = this.ComputeSingleDifficulty(this.nEndHF + (this.nHuntAmount * (p_nHuntNum - 1)), this.nHuntAmount);
  // Army att for this hunt : computed from previous reference ratio and this hunt previous difficulty.
  var nHuntArmyAtt          = nPreviousHuntDiff * this.dHuntsRatiosValues[this.nRefRatioIndex];
  // New real ratio.
  var nNewHuntRealRatio     = nHuntArmyAtt / nNewHuntDiff;
  // New reference ratio index for this hunt.
  var nNewHuntRefRatioIndex = this.getRefRatioIndex(nNewHuntRealRatio);
  // Previous losses for this hunt.
  var nPreviousHuntLosses   = this.ComputeLosses(this.nRefRatioIndex, nPreviousHuntDiff, this.nUsedLevels["Shield"]);
  // New losses for this hunt.
  var oRet                  = this.ComputeLosses(nNewHuntRefRatioIndex, nNewHuntDiff, this.nUsedLevels["Shield"]);

  // Add other result in array to return.
  oRet["VarMIN"]    = (oRet["MIN"] - nPreviousHuntLosses["MIN"]) / nPreviousHuntLosses["MIN"];
  oRet["VarAVG"]    = (oRet["AVG"] - nPreviousHuntLosses["AVG"]) / nPreviousHuntLosses["AVG"];
  oRet["VarMAX"]    = (oRet["MAX"] - nPreviousHuntLosses["MAX"]) / nPreviousHuntLosses["MAX"];
  oRet["RealRatio"] = nNewHuntRealRatio;
  oRet["RefRatio"]  = this.dHuntsRatiosValues[nNewHuntRefRatioIndex];
  return oRet;
}

// ________________________________________________________________________________
// Dispatch Army for each hunt.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.ComputeHuntDispatch = function()
{
  var nAvailableUnits = new Array();;
  var nHuntBaseAtt = 0;
  var nHuntBaseAtt2 = 0;
  var bXp;
  var nRemainingDifficulty = this.nDifficulty;
  var nUnitIndex;
  var nDispatchOrderUnits = this.nXpPriorities.concat(this.nNoXpOrder);
  var nUnitCount = 0;

  // Available units.
  for (var j = 1; j < (this.nUserUsedUnits.length); j++)
  {
    nAvailableUnits[j] = this.nUserUsedUnits[j];
  }

  // Reset each hunt stored data.
  this.nEachHuntDispatchUnits = new Array();
  this.nEachHuntDifficulties  = new Array();
  this.nEachHuntLosses        = new Array();

  // Compute each hunt data.
  for (var iHuntNum = this.nHuntCount - 1; iHuntNum >= 0; iHuntNum--)
  {
    // Initialise unit array for this hunt.
    this.nEachHuntDispatchUnits[iHuntNum] = new Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    // Compute and store difficulty and losses for this hunt.
    this.nEachHuntDifficulties[iHuntNum] = this.ComputeSingleDifficulty(this.nEndHF + (iHuntNum * this.nHuntAmount), this.nHuntAmount);
    this.nEachHuntLosses[iHuntNum] = this.ComputeLosses(this.nRefRatioIndex, this.nEachHuntDifficulties[iHuntNum], this.nUsedLevels["Shield"]);

    // Base attack of units to send for this hunt.
    nHuntBaseAtt = (this.nEachHuntDifficulties[iHuntNum] * this.nPlayerArmyBaseAtt) / this.nDifficulty;

    // Check for available Xp-able units.
    bXp = false;
    for (var j = 0; j < this.nXpPriorities.length; j++)
    {
      nUnitIndex = this.nXpPriorities[j];
      bXp = (bXp || ((nAvailableUnits[nUnitIndex]) > 0));
    }

    // compute YD; number. If Xp : Max * factor, Else dispatch between lasting hunts according to difficulty.
    nUnitIndex = 1;
    if (bXp)
    {
      this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] = Math.round(this.nEachHuntLosses[iHuntNum]["MAX"] * this.dLossesSecurityFactor);
    } else
    {
      this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] = Math.round((nAvailableUnits[nUnitIndex] * this.nEachHuntDifficulties[iHuntNum]) / nRemainingDifficulty);
      nRemainingDifficulty -= this.nEachHuntDifficulties[iHuntNum];
    }
    // Deal with last hunt and check the round do not give more unit than available.
    if ((iHuntNum == 0) || (this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] > nAvailableUnits[nUnitIndex]) || (this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] < 0))
    {
      this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] = nAvailableUnits[nUnitIndex];
    }
    // Decrease remaining YD count by the amount allocated to this hunt.
    nAvailableUnits[nUnitIndex] -= (this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex]);
    // Decrease also required Att for this hunt
    nHuntBaseAtt -= (this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] * oCHS2_data.nUnitsBaseAtt[nUnitIndex]);

    // Dispatch other units.
    for (var j = 0; j < nDispatchOrderUnits.length; j++)
    {
      // Get unit index in dispatch order.
      nUnitIndex = nDispatchOrderUnits[j];

      if ((nAvailableUnits[nUnitIndex] > 0) && (nHuntBaseAtt > 0))
      {
        if ((nAvailableUnits[nUnitIndex] * oCHS2_data.nUnitsBaseAtt[nUnitIndex]) > nHuntBaseAtt)
        {
          // too much of this kind of unit, send only the necessary number.
          nUnitCount = Math.round(nHuntBaseAtt / oCHS2_data.nUnitsBaseAtt[nUnitIndex]);
        } else
        {
          // Not enough of this unit, send all.
          nUnitCount = nAvailableUnits[nUnitIndex];
        }
        // Deal with last hunt and check the round do not give more unit than available.
        if ((iHuntNum == 0)
          || (this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] + nUnitCount > nAvailableUnits[nUnitIndex])
          || (this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] + nUnitCount< 0))
        {
          nUnitCount = nAvailableUnits[nUnitIndex];
        }
        // Decrease remaining units
        this.nEachHuntDispatchUnits[iHuntNum][nUnitIndex] += nUnitCount;
        nAvailableUnits[nUnitIndex] -= nUnitCount;
        // Decrease also required Att for this hunt
        nHuntBaseAtt -= (nUnitCount * oCHS2_data.nUnitsBaseAtt[nUnitIndex]);
      }
    }
  }
  // Checkings
  if (nRemainingDifficulty > this.nHuntCount || nRemainingDifficulty < -this.nHuntCount)
  {
    //alert("Remaining difficulty = " + nRemainingDifficulty + ", possible hunt dispatching error");
  }
};
//

// ________________________________________________________________________________
// Refresh hunt launch col : max losses for other hf.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.RefreshLaunchOtherHF = function(p_nOHF)
{
  var nOth;
  var nSumOth = 0;

  for (var iHunt = 0; iHunt < this.nHuntCount; iHunt++)
  {
    nOth = this.getOtherHFSingleHunt(iHunt + 1, p_nOHF);
    GEBI("CHS2_LaunchColOTHER" + iHunt).innerHTML = oCHS2_util.Format(nOth["MAX"], 0, " ");
    nSumOth += nOth["MAX"];
  }
  GEBI("CHS2_LaunchColFooterOTHER").innerHTML = oCHS2_util.Format(nSumOth, 0, " ");
}

// ________________________________________________________________________________
// Refresh display hunt to launch columns.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.RefreshLaunchColDisplay = function()
{
  // Check what has to be displayed
  var nColumns      = ["NUM", "MAX", "AVG", "OTHER", "DIF", "ATT", "RATIO", "COMPACT", "SINGLE"];
  var nDisp         = new Array();
  nDisp["NUM"]      = GEBI("CHS2_LaunchParamNum").checked;
  nDisp["MAX"]      = GEBI("CHS2_LaunchParamMaxLoss").checked;
  nDisp["AVG"]      = GEBI("CHS2_LaunchParamAvgLoss").checked;
  nDisp["OTHER"]    = GEBI("CHS2_LaunchParamOthLoss").checked;
  nDisp["DIF"]      = GEBI("CHS2_LaunchParamDiff").checked;
  nDisp["ATT"]      = GEBI("CHS2_LaunchParamAtt").checked;
  nDisp["RATIO"]    = GEBI("CHS2_LaunchParamRatio").checked;
  nDisp["COMPACT"]  = GEBI("CHS2_LaunchParamCompact").checked;
  nDisp["SINGLE"]   = GEBI("CHS2_LaunchParamSingle").checked;

  for (var nUnit = 1; nUnit < this.nUserUsedUnits.length; nUnit++)
  {
    nColumns[nColumns.length]   = ("UNIT" + nUnit + "_");
    nDisp["UNIT" + nUnit + "_"] = (!nDisp["COMPACT"]) && (GEBI("CHS2_LaunchParamUnits").checked || (this.nUserUsedUnits[nUnit] > 0));
  }

  for (nCol = 0; nCol < nColumns.length; nCol++)
  {
    csDisplay = nDisp[nColumns[nCol]] ? "table-cell" : "none";
    GEBI("CHS2_LaunchColTitle" + nColumns[nCol]).style.display  = csDisplay;
    GEBI("CHS2_LaunchColFooter" + nColumns[nCol]).style.display = csDisplay;
    for (nHunt = 0; nHunt < this.nHuntCount; nHunt++)
    {
      GEBI("CHS2_LaunchCol" + nColumns[nCol] + nHunt).style.display = csDisplay;
    }
  }
}

// ________________________________________________________________________________
// Display hunt to launch.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.DisplayLauch = function()
{
  var csHTML          = "";
  var nSumDifficulty  = 0;
  var nSumMax         = 0;
  var nSumAvg         = 0;
  var nSumOth         = 0;
  var nSumUnits       = new Array();
  var nAtt            = 0;
  var nBaseAtt        = 0;
  var nSumAtt         = 0;
  var csHuntDispatch;

  // Reset inner html.
  GEBI("CHS2_HuntLaunchDetails").innerHTML = "";

  csHTML += "<table class='boite_amelioration tab_triable rowstyle-alt no-arrow sortable-onload-show-4r' style='border-collapse: collapse'>";

  // Headers
  csHTML += "<tr  class='alt' style=' text-align:center;'>";
  // Hunt number.
  csHTML += "  <td id='CHS2_LaunchColTitleNUM' style='padding-right:10px; '>";
  csHTML += "    <b>" + "No" + "</b>";
  csHTML += "  </td>";
  // Hunt max losses.
  csHTML += "  <td id='CHS2_LaunchColTitleMAX' style='padding-right:10px; '>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColMax"] + "</b>";
  csHTML += "  </td>";
  // Hunt average losses.
  csHTML += "  <td id='CHS2_LaunchColTitleAVG' style='padding-right:10px; '>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColAvg"] + "</b>";
  csHTML += "  </td>";
   // Other HF max losses.
  csHTML += "  <td id='CHS2_LaunchColTitleOTHER' style='padding-right:10px; '>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColOth"] + "</b>";
  csHTML += "  </td>";
  // Units by column.
  for (var nUnit = 1; nUnit < this.nUserUsedUnits.length; nUnit++)
  {
    csHTML += "  <td id='CHS2_LaunchColTitleUNIT" + nUnit + "_' style='text-align:right; padding-right:10px; '>";
    csHTML +=      "<b>" + oCHS2_data.csUnitNamesShortDisplay[nUnit] + "</b>";
    csHTML += "  </td>";
    nSumUnits[nUnit] = 0;
  }
  // Units compacted.
  csHTML += "  <td id='CHS2_LaunchColTitleCOMPACT' style='padding-right:10px; '>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColDispatch"] + "</b>";
  csHTML += "  </td>";
  // Hunt difficulty.
  csHTML += "  <td id='CHS2_LaunchColTitleDIF' style='padding-right:10px; '>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColDiff"] + "</b>";
  csHTML += "  </td>";
  // Hunt attack.
  csHTML += "  <td id='CHS2_LaunchColTitleATT' style='padding-right:10px; '>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColAtt"]  + "</b>";
  csHTML += "  </td>";
  // Hunt ratio.
  csHTML += "  <td id='CHS2_LaunchColTitleRATIO' style='padding-right:10px; '>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColRatio"] + "</b>";
  csHTML += "  </td>";
  // Single launch.
  csHTML += "  <td id='CHS2_LaunchColTitleSINGLE' style='padding-right:10px; ' title='" + this.csGuiLabels["LaunchColSingleTip"] + "'>";
  csHTML += "    <b>" + this.csGuiLabels["LaunchColSingleTitle"] + "</b>";
  csHTML += "  </td>";
  csHTML += "</tr>";

  // Hunts
  for (iHunt = 0; iHunt < this.nHuntCount; iHunt++)
  {
    csHTML += "<tr id='CHS2_LaunchTR_" + iHunt + "' " + ((iHunt & 1) ? "class='alt'" : "") + ">";
    // Hunt number.
    csHTML += "  <td id='CHS2_LaunchColNUM" + iHunt + "' style=' text-align:right; padding-right:10px; '>";
    csHTML +=      "<b>" + (iHunt + 1) + "</b>";
    csHTML += "  </td>";
    // Hunt max losses.
    csHTML += "  <td id='CHS2_LaunchColMAX" + iHunt + "' style='text-align:right; padding-right:10px; '>";
    csHTML +=      oCHS2_util.Format(this.nEachHuntLosses[iHunt]["MAX"], 0, " ");
    csHTML += "  </td>";
    nSumMax += this.nEachHuntLosses[iHunt]["MAX"];
    // Hunt average losses.
    csHTML += "  <td id='CHS2_LaunchColAVG" + iHunt + "' style='text-align:right; padding-right:10px; '>";
    csHTML +=      oCHS2_util.Format(this.nEachHuntLosses[iHunt]["AVG"], 0, " ");
    csHTML += "  </td>";
    nSumAvg += this.nEachHuntLosses[iHunt]["AVG"];
     // Other HF max losses.
    nOth = this.getOtherHFSingleHunt(iHunt + 1, 10000000);
    csHTML += "  <td id='CHS2_LaunchColOTHER" + iHunt + "' style='text-align:right; padding-right:10px; '>";
    csHTML +=      oCHS2_util.Format(nOth["MAX"], 0, " ");
    csHTML += "  </td>";
    nSumOth += nOth["MAX"];
    // Units by column.
    nAtt = 0;
    nBaseAtt = 0;
    csHuntDispatch = "";
    for (var nUnit = 1; nUnit < this.nUserUsedUnits.length; nUnit++)
    {
      csHTML += "  <td id='CHS2_LaunchColUNIT" + nUnit + "_" + iHunt + "' style='text-align:right; padding-right:10px; '>";
      csHTML +=      oCHS2_util.Format(this.nEachHuntDispatchUnits[iHunt][nUnit], 0, " ");
      csHTML += "  </td>";
      nSumUnits[nUnit] += this.nEachHuntDispatchUnits[iHunt][nUnit];
      nBaseAtt += (this.nEachHuntDispatchUnits[iHunt][nUnit] * oCHS2_data.nUnitsBaseAtt[nUnit]);
      if (this.nEachHuntDispatchUnits[iHunt][nUnit] > 0)
        csHuntDispatch += (csHuntDispatch.length > 0 ? "" : "<table style='width:100%;'>")
                        + "<tr><td style='text-align:left;'>"
                        + oCHS2_data.csUnitNamesShortDisplay[nUnit]
                        + " :</td><td style='text-align:right;'>"
                        + oCHS2_util.Format(this.nEachHuntDispatchUnits[iHunt][nUnit], 0, " ")
                        + "</td></tr>";
    }
    // Units compacted.
    csHTML += "  <td id='CHS2_LaunchColCOMPACT" + iHunt + "' style='text-align:left; padding-right:10px; '>";
    csHTML +=      csHuntDispatch + (csHuntDispatch.length > 0 ? "</table>" : "");
    csHTML += "  </td>";
    // Hunt difficulty.
    csHTML += "  <td id='CHS2_LaunchColDIF" + iHunt + "' style='text-align:right; padding-right:10px; '>";
    csHTML +=      oCHS2_util.Format(this.nEachHuntDifficulties[iHunt], 0, " ");
    csHTML += "  </td>";
    nSumDifficulty += this.nEachHuntDifficulties[iHunt];
    // Hunt attack.
    nAtt += nBaseAtt + (nBaseAtt * this.nUsedLevels["Weapon"] / 10)
    csHTML += "  <td id='CHS2_LaunchColATT" + iHunt + "' style='text-align:right; padding-right:10px; '>";
    csHTML +=      oCHS2_util.Format(nAtt, 0, " ");
    csHTML += "  </td>";
    nSumAtt += nAtt;
    // Hunt ratio.
    csHTML += "  <td id='CHS2_LaunchColRATIO" + iHunt + "' style='text-align:right; padding-right:10px; '>";
    csHTML +=      oCHS2_util.Format(nAtt / this.nEachHuntDifficulties[iHunt], 2, " ");
    csHTML += "  </td>";
    // Hunt ratio.
    csHTML += "  <td id='CHS2_LaunchColSINGLE" + iHunt + "' style='text-align:right; padding-right:10px; ' title='" + this.csGuiLabels["LaunchColSingleTip"] + "'>";
    csHTML += "    <a id='CHS2_LaunchSingle_" + iHunt + "' style='text-align:right; padding-right:10px; text-decoration:underline; cursor:pointer; color:#666666;' " + (iHunt == 0 ? "" : "disabled") + " >"
    csHTML +=        this.csGuiLabels["LaunchColSingle"];
    csHTML += "    </a>";
    csHTML += "  </td>";
    csHTML += "</tr>";
  }

  // Footer
  csHTML += "<tr " + ((iHunt & 1) ? "class='alt'" : "") + " style='text-align:rhight;	padding-right:10px;' >";
  // Hunt number.
  csHTML += "  <td id='CHS2_LaunchColFooterNUM' style='text-align:center; padding-right:10px; '>";
  csHTML += "    <b>T</b>";
  csHTML += "  </td>";
  // Hunt max losses.
  csHTML += "  <td id='CHS2_LaunchColFooterMAX' style='text-align:right; padding-right:10px; '>";
  csHTML +=      oCHS2_util.Format(nSumMax, 0, " ");
  csHTML += "  </td>";
  // Hunt average losses.
  csHTML += "  <td id='CHS2_LaunchColFooterAVG' style='text-align:right; padding-right:10px; '>";
  csHTML +=      oCHS2_util.Format(nSumAvg, 0, " ");
  csHTML += "  </td>";
   // Other HF max losses.
  csHTML += "  <td id='CHS2_LaunchColFooterOTHER' style='text-align:right; padding-right:10px; '>";
  csHTML +=      oCHS2_util.Format(nSumOth, 0, " ");
  csHTML += "  </td>";
 // Units by column.
  for (var nUnit = 1; nUnit < this.nUserUsedUnits.length; nUnit++)
  {
    csHTML += "  <td id='CHS2_LaunchColFooterUNIT" + nUnit + "_' style='text-align:right; padding-right:10px; '>";
    csHTML +=      oCHS2_util.Format(nSumUnits[nUnit], 0, " ");
    csHTML += "  </td>";
  }
  // Units compacted.
  csHTML += "  <td id='CHS2_LaunchColFooterCOMPACT' style='text-align:left; padding-right:10px; '>";
  csHTML += "    ";
  csHTML += "  </td>";
  // Hunt difficulty.
  csHTML += "  <td id='CHS2_LaunchColFooterDIF' style='text-align:right; padding-right:10px; '>";
  csHTML +=      oCHS2_util.Format(nSumDifficulty, 0, " ");
  csHTML += "  </td>";
  // Hunt attack.
  csHTML += "  <td id='CHS2_LaunchColFooterATT' style='text-align:right; padding-right:10px; '>";
  csHTML +=      oCHS2_util.Format(nSumAtt, 0, " ");
  csHTML += "  </td>";
  // Hunt ratio.
  csHTML += "  <td id='CHS2_LaunchColFooterRATIO' style='text-align:right; padding-right:10px; '>";
  csHTML +=      oCHS2_util.Format(nSumAtt/nSumDifficulty, 2, " ");
  csHTML += "  </td>";
  // Launch single.
  csHTML += "  <td id='CHS2_LaunchColFooterSINGLE' style='text-align:center; padding-right:10px; '>";
  csHTML += "    <a id ='CHS2_LaunchColFooterSINGLEBtn' title='" + this.csGuiLabels["LaunchColSingleFooterTip"] + "'>";
  csHTML += "      ! <img alt='Unlock' src ='images/icone/verrou.gif' /> ! ";
  csHTML += "    </a>";
  csHTML += "  </td>";
  csHTML += "</tr>";

  csHTML += "</table>";

  // Insert inner html.
  GEBI("CHS2_HuntLaunchDetails").innerHTML = csHTML;
  // Show/Hide required columns.
  this.RefreshLaunchColDisplay();
  // DHTML.
  GEBI("CHS2_LaunchParamNum").onchange      = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamDiff").onchange     = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamUnits").onchange    = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamAtt").onchange      = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamMaxLoss").onchange  = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamRatio").onchange    = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamAvgLoss").onchange  = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamCompact").onchange  = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamSingle").onchange   = function() { oCHS2_simu.RefreshLaunchColDisplay(); };
  GEBI("CHS2_LaunchParamOthLoss").onchange  = function() { oCHS2_simu.RefreshLaunchColDisplay(); };

  // Allow to launch first hunt (single launch).
  GEBI("CHS2_LaunchSingle_" + this.nFirstHuntToLaunch).style.color = "#660099";
  GEBI("CHS2_LaunchSingle_" + this.nFirstHuntToLaunch).onclick = function()
  {
    oCHS2_simu.Launch(oCHS2_simu.nFirstHuntToLaunch, oCHS2_simu.nFirstHuntToLaunch, "", "", false);
  };

  GEBI("CHS2_LaunchColFooterSINGLEBtn").onclick = function()
  {
    oCHS2_simu.UnlockSingleLaunches();
  };
};

// ________________________________________________________________________________
// Refresh launched hunt display.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.RefreshLaunchStatus = function(p_nHunt, p_bSuccess)
{
  if (p_bSuccess)
  {
    GEBI("CHS2_LaunchTR_" + p_nHunt).style.color = "#008000";
    GEBI("CHS2_LaunchSingle_" + p_nHunt).innerHTML = " OK ";
    GEBI("CHS2_LaunchSingle_" + p_nHunt).style.color = "#008000";

    // Allow to launch next hunt.
    if ((p_nHunt + 1) < this.nHuntCount)
    {
      this.nFirstHuntToLaunch = (p_nHunt + 1);
      GEBI("CHS2_LaunchSingle_" + this.nFirstHuntToLaunch).style.color = "#660099";
      GEBI("CHS2_LaunchSingle_" + this.nFirstHuntToLaunch).onclick = function()
      {
        oCHS2_simu.Launch(oCHS2_simu.nFirstHuntToLaunch, oCHS2_simu.nFirstHuntToLaunch, "", "", false);
      }
    } else // If last hunt reload page.
    {
      if (oCHS2_data.csURI == "/Ressources.php") setTimeout(function(){ document.location = "/Ressources.php"; }, 1000) ;
    }
  }
  else
  {
    GEBI("CHS2_LaunchTR_" + p_nHunt).style.color = "#ff0000";
    GEBI("CHS2_LaunchSingle_" + p_nHunt).innerHTML = "! ERROR !";
    GEBI("CHS2_LaunchSingle_" + p_nHunt).style.color = "#ff0000";
  }
  GEBI("CHS2_LaunchSingle_" + p_nHunt).onclick = function() {};

};

// ________________________________________________________________________________
// Unlock single launches.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.UnlockSingleLaunches = function(p_nHunt, p_bSuccess)
{
  for (var nHunt = 0; nHunt < this.nHuntCount; nHunt++)
  {
    GEBI("CHS2_LaunchSingle_" + nHunt).style.color = "#660099";
    GEBI("CHS2_LaunchSingle_" + nHunt).onclick = function()
    {
      var nHunt = parseInt(this.id.replace("CHS2_LaunchSingle_", ""));
      oCHS2_simu.Launch(nHunt, nHunt, "", "", false);
    }
  }
};

// ________________________________________________________________________________
// Launch hunts. Mainly copied on Hrarsvelg's Outiiil.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Simu.prototype.Launch = function(nHunt, nLastHunt, securiteN, securiteV, bFull)
{
	if (!securiteN && !securiteV)
  {
		fzzzAjaxSync({ // Fzzz : $.ajax synchrone ignoré dans l'extension
			url     : "/AcquerirTerrain.php",
			async   : false,
			success : function(data){
				var parsed = $('<div/>').append(data);
				securiteN = parsed.find("table #t").attr('name');
				securiteV = parsed.find("table #t").val();
			}
		});
	}

	var dataSend = {};
	dataSend[securiteN] = securiteV;
	dataSend["ChoixArmee"] = "1";
	dataSend["AcquerirTerrain"] = oCHS2_simu.nHuntAmount;
	dataSend["unite1"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][1];
	dataSend["unite2"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][2];
	dataSend["unite3"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][3];
	dataSend["unite4"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][4];
	dataSend["unite5"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][5];
	dataSend["unite6"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][6];
	dataSend["unite7"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][8];
	dataSend["unite8"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][9];
	dataSend["unite9"]  = oCHS2_simu.nEachHuntDispatchUnits[nHunt][10];
	dataSend["unite10"] = oCHS2_simu.nEachHuntDispatchUnits[nHunt][11];
	dataSend["unite11"] = oCHS2_simu.nEachHuntDispatchUnits[nHunt][13];
	dataSend["unite12"] = oCHS2_simu.nEachHuntDispatchUnits[nHunt][14];
	dataSend["unite13"] = oCHS2_simu.nEachHuntDispatchUnits[nHunt][12];
	dataSend["unite14"] = oCHS2_simu.nEachHuntDispatchUnits[nHunt][7];

	$.post("/AcquerirTerrain.php", dataSend, function(data)
  {
    var bSuccess = !(data.indexOf("Vous n'avez pas") > - 1)

		oCHS2_simu.RefreshLaunchStatus(nHunt, bSuccess);

    if (bSuccess)
    {
      nHunt++;
      if (nHunt < nLastHunt)
      {
        setTimeout(function(){ oCHS2_simu.Launch(nHunt, nLastHunt, securiteN, securiteV, bFull); }, 1000) ;
      } // Done in RefreshLaunchStatus : else { if (bFull) document.location = "/Ressources.php"; }
    }
	});
};

// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// CANCEL HUNTS FUNCTIONS
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

var CHS2_Cancel = function() { };

// ________________________________________________________________________________
// Remove all empty line (including lines with only tab and/or spaces).
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Cancel.prototype.UpdateGUI = function()
{
  var csLabel = "<b> Annuler tout / Cancel All </b>";
  var csTip = "Annule toutes les chasses encore annulable. \nCancel all cancellable hunts."
  var csButtonHTML = "<button id='CHS2_CancelAllBtn' title = '" + csTip + "'> " + csLabel + "</button><br/>";
  $("#boite_tdc span:eq(2)").append(csButtonHTML);
  $("#CHS2_CancelAllBtn").click(function() { oCHS2_cancel.CancelHunts(); });
};

// ________________________________________________________________________________
// Cancel All hunts.
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
CHS2_Cancel.prototype.CancelHunts = function()
{
  var csRegChasseId = "chasse_[0-9]+";
  var csId = "";

  $("#boite_tdc span:gt(2)").each(function()
  {
    if (new RegExp(csRegChasseId, "g").test(this.id))
    {
      csId = (new RegExp(csRegChasseId, "g").exec(this.id))[0];
      $.get("/Ressources.php?annuler=" + csId.replace("chasse_", ""));
    }
  });
  setTimeout(function(){ document.location = "/Ressources.php"; }, 1000) ;
};

// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// SCRIPT MAIN FUNCTION
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

(function ()
{
  // Instanciate classes.
  oCHS2_util    = new CHS2_Util();
  oCHS2_import  = new CalyArmyImport();
  oCHS2_data    = new CHS2_GameData();
  oCHS2_simu    = new CHS2_Simu();
  oCHS2_cancel  = new CHS2_Cancel();

  // Add cancel options.
	if (oCHS2_data.csURI == "/Ressources.php")
  {
    // Fzzz : bouton « Annuler tout » non ajouté, la page a déjà « Annuler toutes les chasses »
    // oCHS2_cancel.UpdateGUI();
    // Add hunt simulator on Resources page.
    oCHS2_simu.buildGUI();
  }
	if (new RegExp("alliancead2.free.fr", "g").test(location.host))
	{
		oCHS2_simu.buildGUI();
	}

})();


// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯
// GREFFON : PILOTAGE PAR BUDGET DE PERTES  (CHS2B)
//
// Bloc purement additif : il ne modifie aucune fonction du simulateur d'origine.
// Il s'appuie sur les globales oCHS2_simu / oCHS2_util / oCHS2_data et pilote
// l'original uniquement via ses champs "Nombre de chasse" / "TdC par chasse"
// (cases Auto décochées), puis appelle ComputeHuntCountAmount() : détails,
// répartition et lanceur tournent donc exactement comme avant.
//
// Principe :
//   budget  X  = (temps de ponte des JSN perdues en moyenne) / (durée de la salve)
//   On cherche le plus petit ratio r tel que ce quotient = X, puis le découpage
//   (n chasses de M cm²) qui maximise le TdC chassé par unité de temps.
//
// Formules réutilisées de l'original :
//   difficulté  : oCHS2_simu.ComputeDifficulty(EndHF, M, n)   (impacts séquentiels)
//   pertes      : table dHuntsRatiosAvgLosses × D × 10/(10+bouclier)
//   durée       : (M + BaseHF) × 0.9^VC
//   ponte JSN   : 300 × 0.9^(Couveuse + Solarium + Technique de ponte)
// ________________________________________________________________________________
// ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯

(function ()
{
  // Ne s'active que si le simulateur d'origine a construit son interface.
  if (typeof oCHS2_simu === "undefined" || !GEBI("CHS2_SimParamFrame")) return;

  // --- Réglages du greffon ----------------------------------------------------
  var CHS2B_DEFAULT_BUDGET_PC = 30;     // % de la ponte sacrifié par défaut
  var CHS2B_DEFAULT_SECURITY  = oCHS2_simu.dLossesSecurityFactor;  // 2.0 dans l'original
  var CHS2B_RATIO_MIN         = 6.0;    // en dessous : zone rouge, on plafonne
  var CHS2B_RATIO_MAX         = 15.0;
  var CHS2B_INTERPOLATE       = false;  // false = même lecture en escalier que
                                        // l'original (cohérence de l'affichage)
                                        // true  = interpolation linéaire de la table
  var bFR = (oCHS2_data.csLang == "FR");

  // --- Lecture des pertes moyennes par point de difficulté -------------------
  var cAvg = function(r)
  {
    var V = oCHS2_simu.dHuntsRatiosValues, C = oCHS2_simu.dHuntsRatiosAvgLosses;
    if (!CHS2B_INTERPOLATE) return C[oCHS2_simu.getRefRatioIndex(r)];
    if (r <= V[0]) return C[0];
    if (r >= V[V.length - 1]) return C[C.length - 1] * V[V.length - 1] / r;
    for (var i = 0; i < V.length - 1; i++)
      if (V[i] <= r && r <= V[i + 1])
      { var w = (r - V[i]) / (V[i + 1] - V[i]); return C[i] * (1 - w) + C[i + 1] * w; }
    return C[C.length - 1];
  };
  var cMax = function(r) { return oCHS2_simu.dHuntsRatiosMaxLosses[oCHS2_simu.getRefRatioIndex(r)]; };

  // --- Paramètres courants du simulateur (lus, jamais écrits) -----------------
  var getParams = function()
  {
    var L = oCHS2_simu.nUsedLevels;
    var nLaying = L["Incubator"] + L["Solarium"] + L["LayingDevice"];
    return {
      A      : oCHS2_simu.nPlayerArmyAtt,
      baseHF : oCHS2_simu.nBaseHF,
      endHF  : oCHS2_simu.nEndHF,
      VC     : L["HuntSpeed"],
      k      : 10 / (10 + L["Shield"]),
      q      : Math.pow(0.9, L["HuntSpeed"]),
      Tjsn   : oCHS2_data.nUnitsLayingTimes[1] * Math.pow(0.9, nLaying),
      JSN    : oCHS2_simu.nUserUsedUnits[1]
    };
  };

  // --- Pour un ratio r et un nombre n : taille M telle que A / D(M, n) = r ----
  var solveAmount = function(P, r, n)
  {
    var D = P.A / r, lo = 1, hi = Math.max(2, D);   // D/g ≥ M, et g ≥ 3 → hi large
    for (var it = 0; it < 80; it++)
    {
      var M = (lo + hi) / 2;
      if (oCHS2_simu.ComputeDifficulty(P.endHF, M, n) < D) lo = M; else hi = M;
    }
    return Math.floor(lo);
  };

  // --- Pour un ratio r : meilleur découpage (max cm²/s), pertes, durée --------
  var planForRatio = function(P, r, nFixed, mFixed)
  {
    var best = null, nMax = P.VC + 1;
    var nFrom = nFixed > 0 ? nFixed : 1, nTo = nFixed > 0 ? nFixed : nMax;
    for (var n = nFrom; n <= nTo; n++)
    {
      var M = mFixed > 0 ? mFixed : solveAmount(P, r, n);
      if (M < 1) continue;
      var D    = oCHS2_simu.ComputeDifficulty(P.endHF, M, n);
      var rr   = P.A / D;
      var t    = (M + P.baseHF) * P.q;
      var lAvg = cAvg(rr) * D * P.k, lMax = cMax(rr) * D * P.k;
      var plan = { n:n, M:M, T:n*M, D:D, r:rr, t:t, lossAvg:lAvg, lossMax:lMax,
                   rate:n*M/t, budget:lAvg*P.Tjsn/t };
      if (best === null || plan.rate > best.rate) best = plan;
    }
    return best;
  };

  // --- Résolution : pour chaque nombre de chasses n, plus petit ratio r tel que
  //     budget(n, r) = X ; on garde le n qui maximise le TdC chassé par seconde.
  //     (Le ratio atteignable dépend de n : à ratio égal, moins de chasses = salve
  //     plus longue = moins de pertes par heure, donc un ratio plus bas possible.)
  var solveForN = function(P, X, n, mFixed)
  {
    var lo = CHS2B_RATIO_MIN, hi = CHS2B_RATIO_MAX;
    var pLo = planForRatio(P, lo, n, mFixed);
    if (!pLo) return null;
    if (pLo.budget < X) { pLo.capped = true; return pLo; }
    for (var it = 0; it < 50; it++)
    {
      var mid = (lo + hi) / 2, pm = planForRatio(P, mid, n, mFixed);
      if (!pm) { hi = mid; continue; }
      if (pm.budget > X) lo = mid; else hi = mid;
    }
    var p = planForRatio(P, hi, n, mFixed);
    if (p) p.capped = false;
    return p;
  };

  var solveBudget = function(X, nFixed, mFixed)
  {
    var P = getParams(), res = { P:P, capped:false, byN:[] };
    if (!(P.A > 0) || !(P.baseHF > 0)) return null;
    var nFrom = nFixed > 0 ? nFixed : 1, nTo = nFixed > 0 ? nFixed : P.VC + 1, best = null;
    for (var n = nFrom; n <= nTo; n++)
    {
      var p = solveForN(P, X, n, mFixed);
      if (!p) continue;
      res.byN.push(p);
      if (best === null || p.rate > best.rate) best = p;
    }
    if (!best) return null;
    res.plan = best; res.capped = best.capped;
    return res;
  };

  // --- Interface --------------------------------------------------------------
  var L = bFR ? {
    title   : "Pilotage par budget de pertes",
    budget  : "JSN sacrifiées : ",
    budgetU : " % du temps de ponte",
    perDay  : "≈ $n JSN / jour",
    apply   : "Calculer et appliquer",
    reset   : "Rendre la main au ratio",
    keepN   : "garder le nombre de chasses saisi",
    keepM   : "garder le TdC par chasse saisi",
    secu    : "Marge JSN : ",
    secuU   : " x pertes max",
    secuTip : "Facteur de sécurité du simulateur d&#39;origine (2 par défaut) : chaque chasse embarque\nfacteur x pertes max en JSN. Si le stock de JSN ne permet pas ce facteur pour toutes\nles chasses, le greffon le réduit uniformément (au lieu de laisser les premières\nchasses partir sans JSN).",
    secuRed : "Marge JSN réduite à x$f (stock $have JSN pour $need de pertes max).",
    jsnDisp : "JSN par chasse : $list",
    exposed : "Tampon incomplet même avec SN/NE, unités chères exposées sur les chasses : $list (déficit en JSN-éq).",
    rebal   : "rééquilibrer le tampon JSN/SN/NE entre chasses",
    launchAll : "Lancer la salve (jeton frais)",
    launchTip : "Lance les chasses une par une en récupérant un nouveau jeton de sécurité avant chacune\n(le bouton d&#39;origine réutilise le premier jeton : seule la première chasse part).\nSuccès vérifié sur le message &quot;La chasse est lancée&quot;.",
    launchFail: "Échec au lancement de la chasse $n : salve interrompue.",
    single    : "lancements individuels via le greffon (jeton frais, succès vérifié)",
    singleTip : "Les liens &quot;Lancer&quot; de chaque chasse passent par le lanceur du greffon au lieu de celui\nd&#39;origine, qui affiche ERROR sur la dernière chasse bien qu&#39;elle soit partie.",
    rebalTip: "Après la répartition du simulateur d&#39;origine, redistribue les JSN au prorata des pertes max, puis\ncomplète un déficit éventuel avec les SN puis les NE (ordre de mort, conversion par PV),\nen les déplaçant entre chasses, totaux inchangés.\nCorrige deux cas où une chasse part sans tampon : stock insuffisant pour la marge,\net unités à XP épuisées avant la dernière chasse traitée.",
    result  : "Ratio <b>$r</b> → <b>$n x $M cm²</b> ($T cm², $pc % du TdC), salve $t, pertes moy. <b>$avg</b> JSN (max $max), budget réel $b %, <b>$rate cm²/jour</b>",
    capped  : "Budget non atteignable sans descendre sous le ratio " + CHS2B_RATIO_MIN + " : plafonné, budget consommé $b %.",
    lowJSN  : "JSN insuffisantes pour couvrir les pertes max : il en faut $need, vous en avez $have.",
    noData  : "Données armée / TdC non disponibles.",
    tip     : "Fixe la part de la production de JSN que vous acceptez de perdre en chasse ;\nle greffon en déduit le ratio, puis le nombre et la taille des chasses qui\nmaximisent le TdC chassé par jour. Appliquer décoche les cases Auto et\nremplit les champs du simulateur : tout le reste (détails, répartition,\nlancement) est calculé par le simulateur d'origine."
  } : {
    title   : "Loss-budget steering",
    budget  : "Sacrificed YD: ",
    budgetU : " % of laying time",
    perDay  : "≈ $n YD / day",
    apply   : "Compute and apply",
    reset   : "Back to ratio control",
    keepN   : "keep entered hunt count",
    keepM   : "keep entered hunt amount",
    secu    : "YD margin: ",
    secuU   : " x max losses",
    secuTip : "Security factor of the original simulator (default 2): each hunt carries\nfactor x max losses in YD. When the YD stock cannot afford it for every hunt,\nthe add-on lowers it uniformly (instead of letting the first hunts leave without YD).",
    secuRed : "YD margin lowered to x$f (stock $have YD for $need max losses).",
    jsnDisp : "YD per hunt: $list",
    exposed : "Buffer still short even with D/TD, expensive units exposed on hunts: $list (deficit in YD-eq).",
    rebal   : "rebalance YD/D/TD buffer across hunts",
    launchAll : "Launch wave (fresh token)",
    launchTip : "Launches hunts one by one, fetching a new security token before each\n(the original button reuses the first token: only the first hunt goes).\nSuccess checked on the game&#39;s confirmation message.",
    launchFail: "Hunt $n failed to launch: wave stopped.",
    single    : "single launches through the add-on (fresh token, verified success)",
    singleTip : "Each hunt&#39;s &quot;Launch&quot; link goes through the add-on launcher instead of the original one,\nwhich shows ERROR on the last hunt although it was sent.",
    rebalTip: "After the original dispatch, redistributes YD (only them) across hunts\nin proportion to each hunt&#39;s max losses, same total.\nFixes two cases where a hunt leaves without buffer: stock too small for the margin,\nand XP units exhausted before the last processed hunt.",
    result  : "Ratio <b>$r</b> → <b>$n x $M cm²</b> ($T cm², $pc % of HF), wave $t, avg losses <b>$avg</b> YD (max $max), actual budget $b %, <b>$rate cm²/day</b>",
    capped  : "Budget not reachable above ratio " + CHS2B_RATIO_MIN + ": capped, budget used $b %.",
    lowJSN  : "Not enough YD to cover max losses: need $need, have $have.",
    noData  : "Army / HF data not available.",
    tip     : "Set the share of your YD production you accept to lose while hunting;\nthe add-on derives the ratio, then the hunt count and size maximizing\nhunted HF per day. Apply unchecks the Auto boxes and fills the simulator\nfields: everything else (details, dispatch, launch) is computed by the\noriginal simulator."
  };

  var fmt = function(v, d) { return oCHS2_util.Format(v, d || 0, " "); };
  var dur = function(s)
  {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h + " h " + (m < 10 ? "0" : "") + m;
  };

  var html = "";
  html += "<div id='CHS2B_Frame' class='boite_amelioration' style='display:block; margin-top:6px; padding:6px 10px; border-top:1px dashed #660099;' title='" + L.tip.replace(/'/g, "&#39;") + "'>";
  html += "  <b style='color:#660099;'>" + L.title + "</b> &nbsp;&nbsp;";
  html += "  <label>" + L.budget + "<input type='text' id='CHS2B_BudgetInput' size='3' style='text-align:right; font-size:16px;' value='" + CHS2B_DEFAULT_BUDGET_PC + "' />" + L.budgetU + "</label>";
  html += "  &nbsp; <span id='CHS2B_PerDay' style='color:grey;'></span>";
  html += "  &nbsp;&nbsp; <button type='button' id='CHS2B_ApplyBtn'>" + L.apply + "</button>";
  html += "  <button type='button' id='CHS2B_ResetBtn'>" + L.reset + "</button>";
  html += "  <br/><label style='margin-left:20px;'><input type='checkbox' id='CHS2B_KeepN' /> " + L.keepN + "</label>";
  html += "  <label style='margin-left:20px;'><input type='checkbox' id='CHS2B_KeepM' /> " + L.keepM + "</label>";
  html += "  <label style='margin-left:20px;' title='" + L.secuTip + "'>" + L.secu + "<input type='text' id='CHS2B_SecuInput' size='2' style='text-align:right;' value='" + oCHS2_simu.dLossesSecurityFactor + "' />" + L.secuU + "</label>";
  html += "  <label style='margin-left:20px;' title='" + L.rebalTip + "'><input type='checkbox' id='CHS2B_Rebal' checked /> " + L.rebal + "</label>";
  html += "  <div id='CHS2B_Result' style='margin-top:4px;'></div>";
  html += "  <div id='CHS2B_Warn' style='margin-top:2px; color:#c00000; font-weight:bold;'></div>";
  html += "</div>";
  GEBI("CHS2_SimParamFrame").insertAdjacentHTML("afterend", html);

  var readBudget = function()
  {
    var x = parseFloat(String(GEBI("CHS2B_BudgetInput").value).replace(",", "."));
    return (isNaN(x) || x <= 0) ? 0 : x / 100;
  };

  var refreshPerDay = function()
  {
    var P = getParams(), X = readBudget();
    GEBI("CHS2B_PerDay").innerHTML = (X > 0 && P.Tjsn > 0) ? L.perDay.replace("$n", fmt(X * 86400 / P.Tjsn)) : "";
  };

  var nSavedRatioIndex = null;   // ratio sélectionné avant la prise de contrôle

  var apply = function()
  {
    var X = readBudget();
    GEBI("CHS2B_Warn").innerHTML = ""; GEBI("CHS2B_Result").innerHTML = "";
    if (X <= 0) return;
    var nFixed = GEBI("CHS2B_KeepN").checked ? parseInt(oCHS2_util.RemoveAllSpaces(GEBI("CHS2_HuntParamHuntNbInput").value)) || 0 : 0;
    var mFixed = GEBI("CHS2B_KeepM").checked ? parseInt(oCHS2_util.RemoveAllSpaces(GEBI("CHS2_HuntParamHuntHFInput").value)) || 0 : 0;

    var res = solveBudget(X, nFixed, mFixed);
    if (!res || !res.plan) { GEBI("CHS2B_Warn").innerHTML = L.noData; return; }
    var p = res.plan, P = res.P;

    // Pilotage de l'original : Auto décoché, champs remplis, recalcul.
    if (nSavedRatioIndex === null) nSavedRatioIndex = oCHS2_simu.nSelectedRefRatioIndex;
    GEBI("CHS2_HuntParamHuntNbAutoCB").checked = false; GEBI("CHS2_HuntParamHuntNbInput").disabled = false;
    GEBI("CHS2_HuntParamHuntHFAutoCB").checked = false; GEBI("CHS2_HuntParamHuntHFInput").disabled = false;
    GEBI("CHS2_HuntParamHuntNbInput").value = fmt(p.n);
    GEBI("CHS2_HuntParamHuntHFInput").value = fmt(p.M);

    // Marge JSN : facteur demandé, réduit uniformément si le stock ne suit pas.
    var fWanted = parseFloat(String(GEBI("CHS2B_SecuInput").value).replace(",", "."));
    if (isNaN(fWanted) || fWanted < 1) fWanted = CHS2B_DEFAULT_SECURITY;
    var fEff = (p.lossMax > 0) ? Math.min(fWanted, P.JSN / p.lossMax) : fWanted;
    oCHS2_simu.dLossesSecurityFactor = fEff;
    oCHS2_simu.ComputeHuntCountAmount();
    var residual = GEBI("CHS2B_Rebal").checked ? rebalanceBuffer(fWanted) : null;

    GEBI("CHS2B_Result").innerHTML = L.result
      .replace("$r", fmt(p.r, 2)).replace("$n", fmt(p.n)).replace("$M", fmt(p.M))
      .replace("$T", fmt(p.T)).replace("$pc", fmt(100 * p.T / P.baseHF, 0))
      .replace("$t", dur(p.t)).replace("$avg", fmt(p.lossAvg)).replace("$max", fmt(p.lossMax))
      .replace("$b", fmt(100 * p.budget, 1)).replace("$rate", fmt(p.rate * 86400));

    var bufList = [];
    for (var i = 0; i < oCHS2_simu.nHuntCount; i++)
    {
      var u = oCHS2_simu.nEachHuntDispatchUnits[i], cs = fmt(u[1]);
      if (u[2] > 0 || u[3] > 0) cs += " (+" + fmt(u[2]) + " SN, " + fmt(u[3]) + " NE)";
      bufList.push(cs);
    }
    GEBI("CHS2B_Result").innerHTML += "<br/>" + L.jsnDisp.replace("$list", bufList.join(" / "));

    var warn = [];
    if (fEff < fWanted - 0.005) warn.push(L.secuRed.replace("$f", fmt(fEff, 2)).replace("$have", fmt(P.JSN)).replace("$need", fmt(p.lossMax)));
    if (residual)
    {
      var exposed = [];
      for (var h = 0; h < residual.length; h++) if (residual[h] > 2) exposed.push((h + 1) + " (" + fmt(residual[h]) + ")");
      if (exposed.length) warn.push(L.exposed.replace("$list", exposed.join(", ")));
    }
    if (res.capped) warn.push(L.capped.replace("$b", fmt(100 * p.budget, 1)));
    if (P.JSN < p.lossMax && !residual) warn.push(L.lowJSN.replace("$need", fmt(p.lossMax)).replace("$have", fmt(P.JSN)));
    GEBI("CHS2B_Warn").innerHTML = warn.join("<br/>");
  };

  // Tampon de pertes par chasse : objectif fWanted x pertes max (en JSN-équivalent).
  // 1) JSN redistribuées au prorata des pertes max (total inchangé).
  // 2) Déficit restant couvert par les unités suivantes dans l'ordre de mort (SN, NE),
  //    déplacées entre chasses au prorata du déficit, conversion par les PV, total inchangé.
  // Puis rafraîchit le tableau de lancement de l'original. Renvoie le déficit résiduel par chasse.
  var rebalanceBuffer = function(fWanted)
  {
    var S = oCHS2_simu, HP = oCHS2_data.nUnitsBaseHP, n = S.nHuntCount, i, k;
    if (n < 1) return [];
    var need = [], sumMax = 0;
    for (i = 0; i < n; i++) { need[i] = fWanted * S.nEachHuntLosses[i]["MAX"]; sumMax += S.nEachHuntLosses[i]["MAX"]; }

    // Unités tampon dans l'ordre de mort : JSN(1), SN(2), NE(3).
    var order = [1, 2, 3];
    for (var o = 0; o < order.length; o++)
    {
      k = order[o];
      var pool = 0; for (i = 0; i < n; i++) pool += S.nEachHuntDispatchUnits[i][k];
      if (pool <= 0) continue;
      var want = [], sumWant = 0;
      for (i = 0; i < n; i++)
      {
        // déficit en JSN-éq → nombre d'unités k nécessaires (PV)
        want[i] = Math.max(0, need[i]) * HP[1] / HP[k];
        sumWant += want[i];
      }
      var alloc = [], given = 0;
      if (sumWant <= 0) continue;
      if (sumWant <= pool)
      {
        // de quoi couvrir tout le monde : le surplus est rendu au prorata de la répartition d'origine
        var surplus = pool - sumWant;
        for (i = 0; i < n; i++) alloc[i] = want[i] + surplus * S.nEachHuntDispatchUnits[i][k] / pool;
      }
      else
      {
        for (i = 0; i < n; i++) alloc[i] = pool * want[i] / sumWant;
      }
      for (i = 0; i < n - 1; i++) { alloc[i] = Math.round(alloc[i]); given += alloc[i]; }
      alloc[n - 1] = pool - given;
      for (i = 0; i < n; i++)
      {
        S.nEachHuntDispatchUnits[i][k] = alloc[i];
        need[i] -= alloc[i] * HP[k] / HP[1];     // ce que ces unités couvrent, en JSN-éq
      }
    }
    S.DisplayLauch();
    var residual = []; for (i = 0; i < n; i++) residual[i] = Math.max(0, Math.round(need[i]));
    return residual;
  };

  var reset = function()
  {
    GEBI("CHS2_HuntParamHuntNbAutoCB").checked = true; GEBI("CHS2_HuntParamHuntNbInput").disabled = true;
    GEBI("CHS2_HuntParamHuntHFAutoCB").checked = true; GEBI("CHS2_HuntParamHuntHFInput").disabled = true;
    GEBI("CHS2B_Result").innerHTML = ""; GEBI("CHS2B_Warn").innerHTML = "";
    oCHS2_simu.dLossesSecurityFactor = CHS2B_DEFAULT_SECURITY;
    if (nSavedRatioIndex !== null)
    {
      oCHS2_simu.nSelectedRefRatioIndex = nSavedRatioIndex;
      GEBI("CHS2_HuntParamBaseRatioSelect").selectedIndex = nSavedRatioIndex;
      nSavedRatioIndex = null;
    }
    oCHS2_simu.ComputeHuntCountAmount();
  };

  GEBI("CHS2B_ApplyBtn").onclick    = apply;
  GEBI("CHS2B_ResetBtn").onclick    = reset;
  GEBI("CHS2B_BudgetInput").onkeyup = refreshPerDay;
  GEBI("CHS2B_BudgetInput").onchange = refreshPerDay;
  GEBI("CHS2B_BudgetInput").onkeydown = function(e) { if (e.key === "Enter") apply(); };
  // Le bouton "Récupérer" de l'original recharge les données : on rafraîchit l'estimation.
  if (GEBI("CHS2_InputTableRetrieve")) GEBI("CHS2_InputTableRetrieve").addEventListener("click", function() { setTimeout(refreshPerDay, 0); });
  refreshPerDay();


  // --- Lanceur de salve à jeton frais ----------------------------------------
  // Le lanceur d'origine récupère le jeton anti-rejeu (#t) une seule fois et le
  // réutilise pour toutes les chasses de la salve ; le jeu le régénère à chaque
  // soumission et ignore silencieusement les suivantes. Il détecte en outre le
  // succès par l'absence de "Vous n'avez pas", ce qui donne des faux OK et des
  // faux ERROR. Ce lanceur : jeton frais avant chaque chasse, succès détecté sur
  // "La chasse est lancée", affichage via RefreshLaunchStatus() de l'original
  // (qui recharge la page après la dernière chasse), arrêt au premier échec.
  var CHS2B_SUCCESS_MARK = "La chasse est lancée";
  var CHS2B_UNIT_FIELDS  = { unite1:1, unite2:2, unite3:3, unite4:4, unite5:5, unite6:6, unite7:8, unite8:9, unite9:10, unite10:11, unite11:13, unite12:14, unite13:12, unite14:7 };
  var bLaunching = false;

  var launchOne = function(nHunt, onDone)
  {
    $.ajax({ url: "/AcquerirTerrain.php", type: "GET", cache: false })
      .fail(function() { onDone(false, "GET jeton KO"); })
      .done(function(page)
      {
        // Même sélecteur que l'original (table #t), repli sur tout input caché #t portant un name.
        var parsed = $("<div/>").append(page);
        var tok = parsed.find("table #t");
        if (!tok.length || !tok.attr("name")) tok = parsed.find("input#t[name]").first();
        var name = tok.attr("name"), val = tok.val();
        if (!name) { onDone(false, "jeton introuvable (" + parsed.find("#t").length + " élément(s) #t)"); return; }
        var data = {}; data[name] = val;
        data["ChoixArmee"] = "1";
        data["AcquerirTerrain"] = oCHS2_simu.nHuntAmount;
        for (var f in CHS2B_UNIT_FIELDS) data[f] = oCHS2_simu.nEachHuntDispatchUnits[nHunt][CHS2B_UNIT_FIELDS[f]];
        $.post("/AcquerirTerrain.php", data)
          .fail(function() { onDone(false, "POST KO"); })
          .done(function(resp) { onDone(String(resp).indexOf(CHS2B_SUCCESS_MARK) > -1, ""); });
      });
  };

  var launchAll = function()
  {
    if (bLaunching) return;
    var nFrom = oCHS2_simu.nFirstHuntToLaunch, nTo = oCHS2_simu.nHuntCount;
    if (nFrom >= nTo) return;
    bLaunching = true;
    GEBI("CHS2B_LaunchBtn").disabled = true;
    var step = function(n)
    {
      launchOne(n, function(ok, why)
      {
        oCHS2_simu.RefreshLaunchStatus(n, ok);          // affichage + rechargement après la dernière
        if (!ok)
        {
          bLaunching = false; GEBI("CHS2B_LaunchBtn").disabled = false;
          GEBI("CHS2B_LaunchMsg").innerHTML = L.launchFail.replace("$n", n + 1) + (why ? " (" + why + ")" : "");
          return;
        }
        if (n + 1 < nTo) setTimeout(function() { step(n + 1); }, 1000);
      });
    };
    GEBI("CHS2B_LaunchMsg").innerHTML = "";
    step(nFrom);
  };

  // Lancement individuel : on intercepte le clic sur une cellule "Lancer" de l'original
  // (phase de capture) seulement si l'original y a posé un vrai lanceur, ce qui respecte
  // son verrouillage "une chasse à la fois" et son bouton de déverrouillage. Le lancement
  // passe alors par launchOne (jeton frais, détection de succès fiable).
  document.addEventListener("click", function(ev)
  {
    var el = ev.target;
    while (el && el !== document && !(el.id && el.id.indexOf("CHS2_LaunchSingle_") === 0)) el = el.parentNode;
    if (!el || el === document) return;
    if (!GEBI("CHS2B_SingleCB") || !GEBI("CHS2B_SingleCB").checked) return;
    if (typeof el.onclick !== "function" || String(el.onclick).indexOf("Launch(") < 0) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (bLaunching) return;
    var n = parseInt(el.id.replace("CHS2_LaunchSingle_", ""));
    bLaunching = true; GEBI("CHS2B_LaunchMsg").innerHTML = "";
    launchOne(n, function(ok, why)
    {
      bLaunching = false;
      oCHS2_simu.RefreshLaunchStatus(n, ok);
      if (!ok) GEBI("CHS2B_LaunchMsg").innerHTML = L.launchFail.replace("$n", n + 1) + (why ? " (" + why + ")" : "");
    });
  }, true);

  if (GEBI("CHS2_LaunchBtn"))
  {
    GEBI("CHS2_LaunchBtn").insertAdjacentHTML("afterend",
      " &nbsp; <button id='CHS2B_LaunchBtn' type='button' style='font-size:125%; color:#660099;' title='" + L.launchTip + "'><b>" + L.launchAll + "</b></button>" +
      "<br/><label title='" + L.singleTip + "'><input type='checkbox' id='CHS2B_SingleCB' checked /> " + L.single + "</label>" +
      "<div id='CHS2B_LaunchMsg' style='color:#c00000; font-weight:bold;'></div>");
    GEBI("CHS2B_LaunchBtn").onclick = launchAll;
  }

  // Exposé pour debug / tests.
  window.oCHS2B = { solveBudget: solveBudget, planForRatio: planForRatio, getParams: getParams, apply: apply, reset: reset, launchAll: launchAll };
})();
// ________________________________________________________________________________
// GREFFON DE DIAGNOSTIC : journal des lancements de chasse (CHS2B_debug)
// Purement additif : écoute les requêtes AJAX de jQuery, n'altère rien.
// Ajoute une zone de texte sous le tableau de lancement avec, pour chaque POST
// vers AcquerirTerrain.php : le jeton envoyé, les unités, et des extraits de la
// réponse (messages d'erreur / de confirmation).
// ________________________________________________________________________________
(function ()
{
  if (typeof $ === "undefined" || !GEBI("CHS2_SimLaunchFrame")) return;

  GEBI("CHS2_SimLaunchFrame").insertAdjacentHTML("beforeend",
    "<div style='margin-top:8px;'><b style='color:#660099;'>Journal des lancements (debug)</b> " +
    "<button type='button' id='CHS2B_DbgClear'>Vider</button><br/>" +
    "<textarea id='CHS2B_DbgLog' rows='12' style='width:100%; font-family:monospace; font-size:11px;'></textarea></div>");
  // Journal persistant (survit au rechargement de page fait par l'original).
  var KEY = "CHS2B_DbgLog";
  var load = function() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  var save = function(v) { try { localStorage.setItem(KEY, v); } catch (e) {} };
  GEBI("CHS2B_DbgLog").value = load();
  GEBI("CHS2B_DbgClear").onclick = function() { GEBI("CHS2B_DbgLog").value = ""; save(""); };

  var log = function(s)
  {
    GEBI("CHS2B_DbgLog").value += s + "\n";
    save(GEBI("CHS2B_DbgLog").value);
    console.log("[CHS2B]", s);
  };
  var now = function() { var d = new Date(); return d.toLocaleTimeString() + "." + ("00" + d.getMilliseconds()).slice(-3); };

  // Extraits de texte autour de mots-clés, balises retirées.
  var KEYWORDS = ["Vous n'avez pas", "Vous n’avez pas", "pas assez", "erreur", "Erreur", "invalide", "expir", "déjà", "chasse", "lanc", "sécurité", "securite", "recharg"];
  var excerpts = function(html)
  {
    var txt = String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    var out = [], seen = {};
    for (var i = 0; i < KEYWORDS.length; i++)
    {
      var p = txt.indexOf(KEYWORDS[i]);
      while (p > -1 && out.length < 12)
      {
        var k = Math.floor(p / 80);
        if (!seen[k]) { seen[k] = 1; out.push("…" + txt.substr(Math.max(0, p - 60), 160) + "…"); }
        p = txt.indexOf(KEYWORDS[i], p + 1);
      }
    }
    return out;
  };

  $(document).ajaxSend(function(ev, xhr, opt)
  {
    if (String(opt.url).indexOf("AcquerirTerrain") < 0) return;
    log(now() + "  " + opt.type + " " + opt.url + (opt.data ? "  data: " + String(opt.data).replace(/&/g, " ") : ""));
  });
  $(document).ajaxComplete(function(ev, xhr, opt)
  {
    if (String(opt.url).indexOf("AcquerirTerrain") < 0) return;
    var body = xhr.responseText || "";
    var m = body.match(/<input[^>]*id=['"]t['"][^>]*>/i);
    log(now() + "  ← " + opt.type + " status " + xhr.status + ", " + body.length + " octets, jeton dans la réponse : " + (m ? m[0].replace(/\s+/g, " ") : "(aucun)"));
    log("     contient \"Vous n'avez pas\" : " + (body.indexOf("Vous n'avez pas") > -1 || body.indexOf("Vous n’avez pas") > -1));
    var ex = excerpts(body);
    for (var i = 0; i < ex.length; i++) log("     " + ex[i]);
  });
  $(document).ajaxError(function(ev, xhr, opt, err)
  {
    if (String(opt.url).indexOf("AcquerirTerrain") < 0) return;
    log(now() + "  ← ERREUR AJAX " + opt.type + " : " + xhr.status + " " + err);
  });

  log("--- " + now() + " page chargée, journal actif (persistant, bouton Vider pour effacer) ---");
})();
} // Fzzz : fin de fzzzLancerCHS2
