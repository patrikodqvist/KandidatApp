kolCalc.factory('calc', function($resource, $cookieStore, Papa) {
	this.list = [];
	this.categories = [];
	this.calcedCat = [];
	this.cat = [];
	this.load = false;
	this.fileChartLoad = false;
	this.chartCalcLoad = false;
	this.hameLoad = false;
	this.filename = [];

	this.fileCalc = [];

	var _this = this;
	var getCookieList = function() {
		var tempList = $cookieStore.get("items");
		for (item in tempList) {
			_this.list.push(tempList[item]);
		}
	}

	var getCookiefile = function() {
		fileCalced = $cookieStore.get("fileCalced");
	}

	//returnerar this.cat
	this.returnCat = function() {
		return this.cat;
	}
	//Returnerar Listan
	this.getList = function() {
		return this.list;
	}

	//Adderar ingrediensen till Listan
	this.addToList = function(result) {
		this.list.push(result);
		this.updateCookies();
	}

	//Adderar calculerad ingrediens
	this.addCalcIng = function(obj) {
		this.calculated.push(obj);
	}

	//lägger in i kakorna
	this.updateCookies = function() {
		var tempList = [];
		for (item in this.list) {
			tempList.push(this.list[item]);
		}

		$cookieStore.put("items", tempList);
	}

	//Raderar ingredienser
	this.removeItem = function(id) {
		for (item in this.list) {
			if (id == this.list[item].id) {
				this.list.splice(item, 1)
			}
		}
		this.updateCookies();
	}

	//Ger totala utsläppet
	this.calcTotalCo2 = function() {
		var co = 0;
		for (item in this.list) {
			co+=this.list[item].carbon.average;
		}
		return co;
	}

	//Skapar kategorierna
	this.createCategories = function(list) {
		this.categories = [];
		for (i = 0; i < 42; i++) {
			var amount = {type:list[i].name, col:0, id:list[i].id, contain:[]};
			this.categories.push(amount);
		}
	}

	//Add item to category
	this.addCategory = function(object) {
		for (category in this.categories) {
			if (object.cat == this.categories[category].id) {
				this.categories[category].col += object.carbon.average;
				this.categories[category].contain.push(object);
			}
		}
	}

	//Add item to category
	this.deleteItemCategory = function(object) {
		for (category in this.categories) {
			if (object.cat == this.categories[category].id) {
				this.categories[category].col -= object.carbon.average;
				var index = this.categories[category].contain.indexOf(object);
				this.categories[category].contain.splice(index,1);
			}
		}
	}

	//Ger ut alla kategorier
	this.getCategorylist = function() {
		return this.categories;
	}

	this.calcCategories = function() {
		var amount = [];
		var titles = [];
		for (category in this.categories) {
			if (this.categories[category].col > 0) {
				amount.push(this.categories[category].col);
				titles.push(this.categories[category].type);
			}
		}
		return [titles,amount];
	}


	this.calcItems = function() {
			var list = [];
            var labels = [];
            var items = this.getList();
            for (item in items) {
                list.push(items[item].carbon.average);
                labels.push(items[item].name);
            }
        return [labels, list];
	}


	//Sökningen i Apit
	this.getIngredient = $resource('http://lcafdb.org/api/ingredients?search=:name',{}, {
		get:{}
	});

	//Sökningen i Apit med id
	this.getIngredientId = $resource('http://lcafdb.org/api/ingredients/:id',{}, {
		get:{}
	});

	//Calculering av ingrediens
	this.calcIng = $resource('http://lcafdb.org/api/func/calculate?ingredient=:id&amount=:amount&unit=:unit',{}, {
		get:{}
	});

	//Hämtar ett Items Kategori
	this.getCategory = $resource('http://lcafdb.org/api/categories',{},{
		get: {}
	});

	//BackEnd Filhantering

	var zeroEmission = 0;
	var globalFoodLib = {};
	var globalJsonFile = {};
	var globalSettings = {};


    var arrangeData = function(jsonFile, setting) {
        /*Takes JSON indata and and setting object. Returns a list of rows:

        var row = {
            "name" : ,
            "massUnit",
            "quantity" : ,
            "organization" :,
            "unit" : ,
            "food" : null,
        }*/

        var fromFile = jsonFile.data;

        var rowList = [];
        var len = fromFile.length;
        //for each row
        for (var i = 0; i < len; i++){
            rowList.push({
                "name" : fromFile[i][setting["name"]],
                "massUnit" : fromFile[i][setting["massUnit"]],
                "quantity" : parseInt(fromFile[i][setting["quantity"]]),
                "organization" : fromFile[i][setting["organization"]],
                "unit" : fromFile[i][setting["unit"]],
                "food" : matchWithFood(fromFile[i][setting["name"]])
            });
            //console.log("Vitkål");
            //console.log(matchWithFood("Vitkål"));
            //console.log(fromFile[i][setting["name"]]);
            //console.log(matchWithFood((fromFile[i][setting["name"]])));
        }

        return rowList;

    }
    var arrangeByUnit = function (rowList) {
        //Returns a unitList which all contain a categoryList-object.
        //for each row: look at the unit. if new unit: create new, otherwise, add through addFood(unitList, unit, food, quantity)
        /*
        var unit = {
            "name" : ,
            "servings" : ,
            "carbon" :{total: } ,
            "foodlist" : []
        }*/
        var units = {};
        var len = rowList.length;
        for (var i = 0; i < len ;i++){
            var unitName = rowList[i]["unit"];
            if (units[unitName] == undefined){ //if the unit has not been found before
                units[unitName] = newUnit(unitName);
            }
            if (rowList[i]["food"] == null){ //if a food object has not been found
                units[unitName]["notFoundList"].push(rowList[i]["name"]);
            }else{ //if a food object has been found
                addFoodToUnit(units, unitName, rowList[i]["food"], rowList[i]["quantity"]);
                //units[unitName]["foodList"].push(rowList[i]["food"]); //
                units[unitName]["foodNameList"].push(rowList[i]["name"]); //ska bort när detta funkar



                if (rowList[i]["food"]["carbon"]["average"] == 0){
                    zeroEmission += 1;
                }
            }
            notFound = units[unitName]["notFoundList"].length;
            found = units[unitName]["foodNameList"].length;
            units[unitName]["accuracy"] = (found / (notFound + found));
        }

        return units;
    }

    var addFoodToUnit = function (units, unitName, food, quantity){
        /*Adds a quantity of food to a unit in a unitList. Returns unitList. */

        var newco2 = (food["carbon"]["average"]*quantity*1000);
        if (newco2 == NaN){
            //console.log("carbon avg: "+food["carbon"]["average"] + "quant: "+ quantity);
        }
        if (newco2 == 0){ // if the newco2 is 0, we try to get the average from the category instead.
            var cat = getCategoryById(food["category"]);
            var carbonFromCat = cat["carbon"]["average"];
            newco2 = carbonFromCat * quantity * 1000;
        }


        units[unitName]["carbon"]["total"] += newco2;

        var cId = food["category"]; //get category id from food object
        // if category is undefined: create new category
        if (units[unitName]["categoryList"][cId] == undefined){
            units[unitName]["categoryList"][cId] = newCategory(cId);
        }
        // go into category
        var category = units[unitName]["categoryList"][cId];
        //add carbon to totCarbon
        category["carbon"]["total"] += newco2;
        // if food (by id) not in foodList:
        if (category["foodList"][food["id"]] == undefined){
            category["foodList"][food["id"]] = food;
            f = category["foodList"][food["id"]];
            f["carbon"]["total"] = 0;
            f["productList"] = [];
        }
        //add food to category.foodList. add productList and carbon["total"] as attributes to the food-object.
        f["carbon"]["total"] += newco2;

        //add carbon and mass to food (by id). add product {name and quantity} to productList. Denna kanske är lite redundant, borde jag ändra? Borde det finnas med namn från exceldokumentet istället för name?
        f["productList"].push({"name" : food["name"], "quantity" : food["quantity"]});

    }

    var newUnit = function(unitName){
        var a = {
            "name" : unitName,
            "servings" : -1,
            "carbon" : {"total": 0},
            "categoryList" : {},
            "notFoundList" : [],
            "foodNameList" : [] //kanske inte behövs
        };
        return a;
    }

    var newCategory = function(id){
        var a = typeof id;
        if (a != "number"){
            throw (Error);
        }
        var c = getCategoryById(id);
        c["carbon"]["total"] = 0;
        c["foodList"] = {};
        return c;
    }



    var matchWithFood = function(name) { //testad, verkar fungera
        //Match a name in with a name in the sorted array foodLib.
        try{
            var words = (name.split(" ")); //get the words from the string in array
        }catch(err){

        }
        var len = words.length;
        if (len > 1){
            words = words.concat(name); // also add the full name
            len  = words.length;
        }
        var foundFood = false;
        for (var j = 0; j < len;j++){ //for each word, as long as we have not found a match
            foundFood = inFoodLib(words[j]);
            if (foundFood != false) { //hittar vi en matchning i foodLib?
                return foundFood;
            }
        }
        return null;
    }

    var regExpMatch = function (word1, word2) {
        //is there a word2 in word1? Returns true/false.
        word1 = word1.toUpperCase()
        var patt = new RegExp(word2.toUpperCase());
        return patt.test(word1);
    }



    var inFoodLib = function(word) { //testad
        //takes word and returns true of word is a name in foodLib, otherwise false.
        var foodLib = getFoodDict()["ingredients"];
        var len = foodLib.length;
        for (var i = 0; i < len; i++) {
            if (word.toUpperCase() == foodLib[i]["name"].toUpperCase()) {
                return (foodLib[i]);
             }else if (regExpMatch(word, foodLib[i]["name"]) == true) {
                return foodLib[i];
             }else if (regExpMatch(foodLib[i]["name"], word) == true) {
                return foodLib[i];
            } else {

            }
        }
        return false;
    }

    var sortByFoodName = function (foodLib) {
        /* Takes a foodLib, returns it sorted by the foodLib[i]["name"].*/
        foodLib.sort(function(a,b){
            if (a["name"] < b["name"]) {
                return -1;
            }
            if (a["name"] > b["name"]) {
                return 1;
            }
            // a must be equal to b
            return 0;
        });
        return foodLib;

    }


    var getFoodDict = function (){


        a = {
            "ingredients":[
                {
                    "id": 1,
                    "name": "Svål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 2,
                    "name": "Ister",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 3,
                    "name": "Späck",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 4,
                    "name": "Talg",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 81,
                    "name": "Bondbönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 71,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 83,
                    "name": "Bruna bönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 88,
                    "name": "Glasnudlar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 89,
                    "name": "Gröna bönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 94,
                    "name": "Gröna linser",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.9,
                        "max": 0.9,
                        "min": 0.9
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 96,
                    "name": "Gröna ärter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.32,
                        "max": 0.32,
                        "min": 0.32
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 98,
                    "name": "Gula ärter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.32,
                        "max": 0.32,
                        "min": 0.32
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 99,
                    "name": "Kidneybönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 100,
                    "name": "Kikärter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 106,
                    "name": "Linser",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.9,
                        "max": 0.9,
                        "min": 0.9
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 109,
                    "name": "Mungbönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 111,
                    "name": "Röda bönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 113,
                    "name": "Röda linser",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 80,
                    "carbon": {
                        "average": 0.9,
                        "max": 0.9,
                        "min": 0.9
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 115,
                    "name": "Sockerärter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 90,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 116,
                    "name": "Sojabönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 118,
                    "name": "Sojakorv",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.72,
                        "max": 0.72,
                        "min": 0.72
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 120,
                    "name": "Svarta bönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 121,
                    "name": "Vignabönor svartögda bönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 126,
                    "name": "Vita bönor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 130,
                    "name": "Ärtpuré",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 131,
                    "name": "Blodbröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 132,
                    "name": "Blodbröd paltbröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 133,
                    "name": "Bröd mörkt glutenfritt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 134,
                    "name": "Bröd vitt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 135,
                    "name": "Bröd vitt glutenfritt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 136,
                    "name": "Croissant fransk giffel",
                    "gramPerPiece": 50,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 139,
                    "name": "Fullkornsskorpor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 140,
                    "name": "Glutenfritt hårt bröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 143,
                    "name": "Grahamsbröd fullkorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 144,
                    "name": "Grahamsscones fullkorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 146,
                    "name": "Hamburgerbröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 147,
                    "name": "Hamburgerbröd grovt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 148,
                    "name": "Hårt bröd fullkorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 166,
                    "name": "Hårt bröd glutenfritt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 168,
                    "name": "Knäckebröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 171,
                    "name": "Hårt tunnbröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 174,
                    "name": "Korvbröd",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 175,
                    "name": "Korvbröd grovt",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 177,
                    "name": "Rågbröd fullkorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 185,
                    "name": "Rågsiktsbröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 189,
                    "name": "Rågskorpor",
                    "gramPerPiece": 10,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 191,
                    "name": "Ströbröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 50,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 192,
                    "name": "Tacoskal",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 193,
                    "name": "Tunnbröd vitt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 194,
                    "name": "Veteskorpor",
                    "gramPerPiece": 10,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 196,
                    "name": "Vitt bröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 212,
                    "name": "Choklad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 7
                },
                {
                    "id": 220,
                    "name": "Kakaopulver",
                    "gramPerPiece": 2,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 7
                },
                {
                    "id": 232,
                    "name": "Mjölkchoklad",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 7
                },
                {
                    "id": 238,
                    "name": "Vit choklad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 7
                },
                {
                    "id": 239,
                    "name": "A-fil",
                    "gramPerPiece": 250,
                    "gramPerDeciliter": 103,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 241,
                    "name": "Delikatessyoghurt",
                    "gramPerPiece": 250,
                    "gramPerDeciliter": 103,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 243,
                    "name": "Filmjölk",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 248,
                    "name": "Fruktyoghurt",
                    "gramPerPiece": 250,
                    "gramPerDeciliter": 103,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 258,
                    "name": "Matlagningsyoghurt",
                    "gramPerPiece": 250,
                    "gramPerDeciliter": 103,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 261,
                    "name": "Yoghurt",
                    "gramPerPiece": 250,
                    "gramPerDeciliter": 103,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 265,
                    "name": "Abborre",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 268,
                    "name": "Alaska pollock",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 270,
                    "name": "Blåmusslor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 271,
                    "name": "Bläckfisk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 272,
                    "name": "Braxen",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 273,
                    "name": "Böckling",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 277,
                    "name": "Crab sticks",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 280,
                    "name": "Fiskbullar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 285,
                    "name": "Fiskfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 292,
                    "name": "Fiskpastej",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 294,
                    "name": "Fiskpinnar",
                    "gramPerPiece": 25,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 299,
                    "name": "Flundra",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 305,
                    "name": "Grodlår",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 306,
                    "name": "Guldsparid",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 308,
                    "name": "Gädda",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 311,
                    "name": "Gös",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 312,
                    "name": "Havsabborre",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 314,
                    "name": "Havskräftor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 315,
                    "name": "Hoki",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 317,
                    "name": "Hummer",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 61,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 319,
                    "name": "Hälleflundra",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 326,
                    "name": "Kapkummel",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 327,
                    "name": "Kaviar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 331,
                    "name": "Kolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 333,
                    "name": "Krabba",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 65,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 335,
                    "name": "Kräfta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 336,
                    "name": "Kräftor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 337,
                    "name": "Kräftströmming",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 338,
                    "name": "Kummel",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 339,
                    "name": "Lake",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 345,
                    "name": "Lax",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 6.45,
                        "max": 11.9,
                        "min": 2.15
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 355,
                    "name": "Lutfisk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 357,
                    "name": "Löjroad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 361,
                    "name": "Makrill",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 366,
                    "name": "Marulk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 367,
                    "name": "Musslor",
                    "gramPerPiece": 6,
                    "gramPerDeciliter": 72,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 369,
                    "name": "Ostron",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 371,
                    "name": "Pangasiusmal",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 372,
                    "name": "Piggvar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 374,
                    "name": "Pilgrimsmusslor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 375,
                    "name": "Pinklax",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 378,
                    "name": "Regnbågslax",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 382,
                    "name": "Räkor",
                    "gramPerPiece": 3,
                    "gramPerDeciliter": 54,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 389,
                    "name": "Röding",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 391,
                    "name": "Rödspätta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 396,
                    "name": "Sardeller",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 399,
                    "name": "Sej",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 402,
                    "name": "Sik",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 406,
                    "name": "Siklöja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 408,
                    "name": "Sill",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 2.1,
                        "max": 2.1,
                        "min": 2.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 419,
                    "name": "Sniglar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 420,
                    "name": "Stenbitskaviar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 421,
                    "name": "Strömming",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 435,
                    "name": "Tilapia",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 439,
                    "name": "Tonfisk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 6.1,
                        "max": 6.1,
                        "min": 6.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 443,
                    "name": "Torsk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 4.7,
                        "max": 7.3,
                        "min": 1.5
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 447,
                    "name": "Torskrom",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 449,
                    "name": "Vitling",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 454,
                    "name": "Ål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 459,
                    "name": "Öring",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 461,
                    "name": "Bacon",
                    "gramPerPiece": 140,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 463,
                    "name": "Fläskkotlett",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 465,
                    "name": "Gris bog",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 466,
                    "name": "Gris bogbladsstek",
                    "gramPerPiece": 1500,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 469,
                    "name": "Fläskfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 471,
                    "name": "Fläskkarré",
                    "gramPerPiece": 299,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 480,
                    "name": "Fläskfilé",
                    "gramPerPiece": 600,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 482,
                    "name": "Fläsklägg",
                    "gramPerPiece": 400,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 484,
                    "name": "Gris fötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 486,
                    "name": "Gris grytbitar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 487,
                    "name": "Kassler",
                    "gramPerPiece": 600,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 488,
                    "name": "Gris picnicbog",
                    "gramPerPiece": 350,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 489,
                    "name": "Gris revbensspjäll",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 491,
                    "name": "Sidfläsk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 492,
                    "name": "Gris skinka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 496,
                    "name": "Frukostflingor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 10
                },
                {
                    "id": 523,
                    "name": "Risdiet flingor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 10
                },
                {
                    "id": 524,
                    "name": "Vetediet",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 20,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 10
                },
                {
                    "id": 525,
                    "name": "Vetekross veteflingor fullkorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 10
                },
                {
                    "id": 526,
                    "name": "Ananas",
                    "gramPerPiece": 590,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.92,
                        "max": 0.92,
                        "min": 0.92
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 527,
                    "name": "Apelsin",
                    "gramPerPiece": 175,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.92,
                        "max": 0.92,
                        "min": 0.92
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 529,
                    "name": "Aprikos",
                    "gramPerPiece": 40,
                    "gramPerDeciliter": 135,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 530,
                    "name": "Aronia",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 531,
                    "name": "Banan",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 1.13,
                        "max": 1.25,
                        "min": 1.01
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 532,
                    "name": "Björnbär",
                    "gramPerPiece": 6,
                    "gramPerDeciliter": 95,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 535,
                    "name": "Blåbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 61,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 538,
                    "name": "Cherimoya",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.92,
                        "max": 0.92,
                        "min": 0.92
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 539,
                    "name": "Citron",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 541,
                    "name": "Fikon",
                    "gramPerPiece": 20,
                    "gramPerDeciliter": 78,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 542,
                    "name": "Fläderbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 61,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 543,
                    "name": "Granatäpple",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.92,
                        "max": 0.92,
                        "min": 0.92
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 544,
                    "name": "Grapefrukt",
                    "gramPerPiece": 250,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 545,
                    "name": "Guava",
                    "gramPerPiece": 90,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 546,
                    "name": "Hallon",
                    "gramPerPiece": 4,
                    "gramPerDeciliter": 52,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 549,
                    "name": "Havtorn",
                    "gramPerPiece": 4,
                    "gramPerDeciliter": 50,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 550,
                    "name": "Hjortron",
                    "gramPerPiece": 4,
                    "gramPerDeciliter": 50,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 551,
                    "name": "Honungsmelon",
                    "gramPerPiece": 8,
                    "gramPerDeciliter": 72,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 552,
                    "name": "Jordgubbar",
                    "gramPerPiece": 9,
                    "gramPerDeciliter": 60,
                    "carbon": {
                        "average": 0.43,
                        "max": 0.43,
                        "min": 0.43
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 556,
                    "name": "Kaktusfikon",
                    "gramPerPiece": 103,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 558,
                    "name": "Kiwi",
                    "gramPerPiece": 80,
                    "gramPerDeciliter": 70,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 559,
                    "name": "Kokbanan",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 560,
                    "name": "Krusbär",
                    "gramPerPiece": 3,
                    "gramPerDeciliter": 60,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 561,
                    "name": "Kumquat",
                    "gramPerPiece": 19,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 562,
                    "name": "Kvitten",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 563,
                    "name": "Lime",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 564,
                    "name": "Lingon",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 60,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 565,
                    "name": "Mango",
                    "gramPerPiece": 240,
                    "gramPerDeciliter": 70,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 566,
                    "name": "Nektarin",
                    "gramPerPiece": 115,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 567,
                    "name": "Nätmelon",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 568,
                    "name": "Papaya",
                    "gramPerPiece": 185,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 569,
                    "name": "Paradisäpplen",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 570,
                    "name": "Passionsfrukt",
                    "gramPerPiece": 20,
                    "gramPerDeciliter": 97,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 571,
                    "name": "Persika",
                    "gramPerPiece": 145,
                    "gramPerDeciliter": 78,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 572,
                    "name": "Physalis",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 573,
                    "name": "Plommon",
                    "gramPerPiece": 33,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 574,
                    "name": "Päron",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 576,
                    "name": "Rabarber",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 577,
                    "name": "Russin",
                    "gramPerPiece": 4,
                    "gramPerDeciliter": 61,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 578,
                    "name": "Röda vinbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 50,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 579,
                    "name": "Sharon",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 580,
                    "name": "Mandarin",
                    "gramPerPiece": 100,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 581,
                    "name": "Surkörsbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 582,
                    "name": "Svarta vinbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 50,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 583,
                    "name": "Sötkörsbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 584,
                    "name": "Tranbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 585,
                    "name": "Vattenmelon",
                    "gramPerPiece": 3000,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 586,
                    "name": "Vindruvor",
                    "gramPerPiece": 15,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 587,
                    "name": "Vita vinbär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 50,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 588,
                    "name": "Ä\u0080pple",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 590,
                    "name": "Ankbröst",
                    "gramPerPiece": 300,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 591,
                    "name": "Anka",
                    "gramPerPiece": 2000,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 593,
                    "name": "Duva",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 597,
                    "name": "Fasan",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 602,
                    "name": "Gås",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 603,
                    "name": "Höna",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 606,
                    "name": "Kalkon filé",
                    "gramPerPiece": 3000,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 7.31,
                        "max": 10.9,
                        "min": 3.71
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 608,
                    "name": "Kalkon",
                    "gramPerPiece": 3000,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 7.31,
                        "max": 10.9,
                        "min": 3.71
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 612,
                    "name": "Kycklingben",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 613,
                    "name": "Kycklingbröst",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 615,
                    "name": "Kycklingbröstfilé",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 618,
                    "name": "Kycklingkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 619,
                    "name": "Kycklingfilé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 3.62,
                        "max": 6.9,
                        "min": 1.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 621,
                    "name": "Kycklinglår",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 623,
                    "name": "Kyckling",
                    "gramPerPiece": 1000,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 3.62,
                        "max": 6.9,
                        "min": 1.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 624,
                    "name": "Kycklingvinge",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 625,
                    "name": "Kycklingfrikassé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 630,
                    "name": "Ripa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 632,
                    "name": "Strutsfilé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 635,
                    "name": "Glass",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 13
                },
                {
                    "id": 654,
                    "name": "Crème Fraiche",
                    "gramPerPiece": 15,
                    "gramPerDeciliter": 99,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 14
                },
                {
                    "id": 658,
                    "name": "Gräddfil",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 14
                },
                {
                    "id": 659,
                    "name": "Kaffegrädde",
                    "gramPerPiece": 15,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 14
                },
                {
                    "id": 660,
                    "name": "Matlagningsgrädde",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 14
                },
                {
                    "id": 662,
                    "name": "Mellangrädde",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 14
                },
                {
                    "id": 665,
                    "name": "Vispgrädde",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 14
                },
                {
                    "id": 666,
                    "name": "Agar torkad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 668,
                    "name": "Alfagroddar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 20,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 669,
                    "name": "Aubergine",
                    "gramPerPiece": 400,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 672,
                    "name": "Avokado",
                    "gramPerPiece": 120,
                    "gramPerDeciliter": 53,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 673,
                    "name": "Bambuskott",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 674,
                    "name": "Blomkål",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.29,
                        "max": 0.34,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 679,
                    "name": "Bostongurka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 680,
                    "name": "Broccoli",
                    "gramPerPiece": 180,
                    "gramPerDeciliter": 65,
                    "carbon": {
                        "average": 1.31,
                        "max": 2,
                        "min": 0.62
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 685,
                    "name": "Brunkål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 686,
                    "name": "Brysselkål",
                    "gramPerPiece": 19,
                    "gramPerDeciliter": 65,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 688,
                    "name": "Champinjoner",
                    "gramPerPiece": 25,
                    "gramPerDeciliter": 30,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 692,
                    "name": "Chilipeppar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 693,
                    "name": "Endivesallat",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 694,
                    "name": "Fefferoni",
                    "gramPerPiece": 15,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 695,
                    "name": "Friséesallat",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 696,
                    "name": "Fänkål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 699,
                    "name": "Gräslök",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 704,
                    "name": "Grönkål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 725,
                    "name": "Gurka",
                    "gramPerPiece": 400,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 1.12,
                        "max": 1.12,
                        "min": 1.12
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 729,
                    "name": "Huvudsallat",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 730,
                    "name": "Isbergssallad",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.53,
                        "max": 0.7,
                        "min": 0.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 731,
                    "name": "Jordärtskocka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 735,
                    "name": "Kantarell",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 30,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 736,
                    "name": "Kelp torkad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 737,
                    "name": "Kronärtskocka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 743,
                    "name": "Kålrabbi",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 744,
                    "name": "Kålrot",
                    "gramPerPiece": 35,
                    "gramPerDeciliter": 72,
                    "carbon": {
                        "average": 0.24,
                        "max": 0.24,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 746,
                    "name": "Linsgroddar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 80,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 747,
                    "name": "Gul lök",
                    "gramPerPiece": 100,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.18,
                        "max": 0.23,
                        "min": 0.13
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 748,
                    "name": "Schalottenlök",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 749,
                    "name": "Röd lök",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.18,
                        "max": 0.23,
                        "min": 0.13
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 750,
                    "name": "Mâchesallat",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 751,
                    "name": "Majrova",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 752,
                    "name": "Majskolv",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 755,
                    "name": "Majskorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 757,
                    "name": "Mangold",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 762,
                    "name": "Mungbönsgroddar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 44,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 765,
                    "name": "Nässlor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 766,
                    "name": "Oliver gröna",
                    "gramPerPiece": 5,
                    "gramPerDeciliter": 45,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 767,
                    "name": "Oliver svarta",
                    "gramPerPiece": 5,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 768,
                    "name": "Palsternacka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.25,
                        "max": 0.26,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 771,
                    "name": "Paprika grön",
                    "gramPerPiece": 130,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 774,
                    "name": "Paprika gul",
                    "gramPerPiece": 130,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 775,
                    "name": "Paprika röd",
                    "gramPerPiece": 130,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 776,
                    "name": "Pepparrot",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 778,
                    "name": "Pumpa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 779,
                    "name": "Purjolök",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 33,
                    "carbon": {
                        "average": 0.24,
                        "max": 0.25,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 782,
                    "name": "Romansallat",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 783,
                    "name": "Rostad lök",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 784,
                    "name": "Rotpersilja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 785,
                    "name": "Rotsaksbiff",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 788,
                    "name": "Rotselleri",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.25,
                        "max": 0.26,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 790,
                    "name": "Rucolasallat",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 792,
                    "name": "Rädisa",
                    "gramPerPiece": 10,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 793,
                    "name": "Rättika",
                    "gramPerPiece": 15,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 794,
                    "name": "Röd mangold",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 796,
                    "name": "Rödkål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 800,
                    "name": "Salladskål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 801,
                    "name": "Saltgurka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 802,
                    "name": "Savojkål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 803,
                    "name": "Körsbärstomat",
                    "gramPerPiece": 15,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 11.9,
                        "max": 11.9,
                        "min": 11.9
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 804,
                    "name": "Sojabönsgroddar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 806,
                    "name": "Soltorkade tomater",
                    "gramPerPiece": 65,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 808,
                    "name": "Sparris",
                    "gramPerPiece": 80,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 810,
                    "name": "Spenat",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 815,
                    "name": "Squash",
                    "gramPerPiece": 400,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 816,
                    "name": "Stjälkselleri",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.18,
                        "max": 0.23,
                        "min": 0.13
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 817,
                    "name": "Surkål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 818,
                    "name": "Svamp",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 819,
                    "name": "Svartrot",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 820,
                    "name": "Syltlök",
                    "gramPerPiece": 2,
                    "gramPerDeciliter": 69,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 822,
                    "name": "Tomat",
                    "gramPerPiece": 65,
                    "gramPerDeciliter": 67,
                    "carbon": {
                        "average": 1.47,
                        "max": 2.5,
                        "min": 0.82
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 825,
                    "name": "Tomater krossade",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.82,
                        "max": 0.82,
                        "min": 0.82
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 826,
                    "name": "Tomatpasta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0.82,
                        "max": 0.82,
                        "min": 0.82
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 827,
                    "name": "Tomatpuré",
                    "gramPerPiece": 18,
                    "gramPerDeciliter": 120,
                    "carbon": {
                        "average": 0.82,
                        "max": 0.82,
                        "min": 0.82
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 831,
                    "name": "Torkade tomater",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.82,
                        "max": 0.82,
                        "min": 0.82
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 832,
                    "name": "Trädgårdskrasse",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 833,
                    "name": "Vattenkrasse",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 14,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 834,
                    "name": "Vaxbönor",
                    "gramPerPiece": 8,
                    "gramPerDeciliter": 53,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 838,
                    "name": "Vitkål",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 844,
                    "name": "Wokgrönsaker",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 847,
                    "name": "Ärter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 848,
                    "name": "Ättiksgurka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 849,
                    "name": "Grisblod",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 850,
                    "name": "Grishjärta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 851,
                    "name": "Grislever",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 852,
                    "name": "Grisnjure",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 853,
                    "name": "Gris tunga",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 854,
                    "name": "Hjärta kalv",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 856,
                    "name": "Kalv bräss",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 857,
                    "name": "Kalv lever",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 858,
                    "name": "Kalv njure",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 859,
                    "name": "Kalv tunga",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 860,
                    "name": "Kycklinghjärta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 861,
                    "name": "Kycklinglever",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 863,
                    "name": "Kycklingmage",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 865,
                    "name": "Lamm bräss",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 866,
                    "name": "Lamm hjärta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 867,
                    "name": "Lamm lever",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 868,
                    "name": "Lamm njure",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 869,
                    "name": "Lamm tunga",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 882,
                    "name": "Nötblod",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 885,
                    "name": "Nötnjure",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 886,
                    "name": "Oxtunga",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 888,
                    "name": "Nötlever",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 889,
                    "name": "Ren lever",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 911,
                    "name": "Ananasjuice",
                    "gramPerPiece": 18,
                    "gramPerDeciliter": 121,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 912,
                    "name": "Apelsinjuice",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 92.5,
                    "carbon": {
                        "average": 0.94,
                        "max": 0.94,
                        "min": 0.94
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 914,
                    "name": "Apelsinnektar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 915,
                    "name": "Aprikosnektar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 916,
                    "name": "Citronjuice",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 103,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 918,
                    "name": "Druvjuice",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 919,
                    "name": "Grapefruktjuice",
                    "gramPerPiece": 18,
                    "gramPerDeciliter": 120,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 921,
                    "name": "Grönsaksjuice",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 922,
                    "name": "Limejuice",
                    "gramPerPiece": 16,
                    "gramPerDeciliter": 104,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 924,
                    "name": "Morotsjuice",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 925,
                    "name": "Persikonektar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 926,
                    "name": "Päronnektar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 928,
                    "name": "Tomatjuice",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 929,
                    "name": "Äppeljuice",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 17
                },
                {
                    "id": 930,
                    "name": "Kaffe",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 4.02,
                        "max": 4.98,
                        "min": 3.05
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 18
                },
                {
                    "id": 950,
                    "name": "Aprikoser",
                    "gramPerPiece": 40,
                    "gramPerDeciliter": 135,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 19
                },
                {
                    "id": 955,
                    "name": "Dadlar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 19
                },
                {
                    "id": 969,
                    "name": "Nypon",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 19
                },
                {
                    "id": 972,
                    "name": "Persikor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 19
                },
                {
                    "id": 981,
                    "name": "Äpplen",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.18,
                        "max": 0.18,
                        "min": 0.18
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 19
                },
                {
                    "id": 983,
                    "name": "Blodpudding",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 986,
                    "name": "Chorizo",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 994,
                    "name": "Falukorv",
                    "gramPerPiece": 1500,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 995,
                    "name": "Fläskkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 999,
                    "name": "Frukostkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1000,
                    "name": "Grillkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1004,
                    "name": "Isterband",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1005,
                    "name": "Kabanoss",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1017,
                    "name": "Kycklingköttbullar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 1018,
                    "name": "Köttkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1020,
                    "name": "Lamm korv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1022,
                    "name": "Medvurst",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1023,
                    "name": "Pressylta",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1026,
                    "name": "Prinskorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1027,
                    "name": "Ren korv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1032,
                    "name": "Salami",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1035,
                    "name": "Salsiccia",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1037,
                    "name": "Skinkkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1041,
                    "name": "Stångkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1047,
                    "name": "Varmkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1052,
                    "name": "Wienerkorv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1059,
                    "name": "Läsk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 21
                },
                {
                    "id": 1072,
                    "name": "Margarin",
                    "gramPerPiece": 14,
                    "gramPerDeciliter": 95,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 22
                },
                {
                    "id": 1098,
                    "name": "Matfettsblandning",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 22
                },
                {
                    "id": 1102,
                    "name": "Bovetemjöl ljust",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 50,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1104,
                    "name": "Grahamsmjöl fullkorn vete",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 60,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1105,
                    "name": "Grovt vetemjöl berik",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 67,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1106,
                    "name": "Havremust pulver berik",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1107,
                    "name": "Kornmjöl fullkorn",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1108,
                    "name": "Majsmjöl",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1109,
                    "name": "Majsstärkelse",
                    "gramPerPiece": 8,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1110,
                    "name": "Majsvälling",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1111,
                    "name": "Mjölblandning grov vete råg vitberik",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1112,
                    "name": "Mjölblandning rågsikt m vetemjöl vitberik",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1113,
                    "name": "Mjölblandning vete råg korn havre vitberik",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1114,
                    "name": "Potatismjöl",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 80,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1115,
                    "name": "Rismjöl",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1116,
                    "name": "Rågmjöl fullkorn",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1117,
                    "name": "Sojamjöl",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 30,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1118,
                    "name": "Vetemjöl",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 67,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1122,
                    "name": "Vetemjölsvälling",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 67,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1125,
                    "name": "Vällingpulver",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1130,
                    "name": "Lättmjölk",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 24
                },
                {
                    "id": 1132,
                    "name": "Mellanmjölk",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 24
                },
                {
                    "id": 1134,
                    "name": "Minimjölk",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 24
                },
                {
                    "id": 1141,
                    "name": "Nöt biff ryggbiff",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1142,
                    "name": "Nöt bog märgpipa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1144,
                    "name": "Entrecôte",
                    "gramPerPiece": 135,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1145,
                    "name": "Nöt flankstek",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1146,
                    "name": "Nöt fransyska",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1149,
                    "name": "Nöt grytbitar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1150,
                    "name": "Nöt hamburgare",
                    "gramPerPiece": 100,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1153,
                    "name": "Nöt högrev",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1154,
                    "name": "Nöt innanlår",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1156,
                    "name": "Nöt lägg",
                    "gramPerPiece": 57,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1157,
                    "name": "Nöt oxbringa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1159,
                    "name": "Oxfilé",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1160,
                    "name": "Nöt oxsvans",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1161,
                    "name": "Nöt rostbiff",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1163,
                    "name": "Nöt stek",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1164,
                    "name": "Nöt ytterlår",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1165,
                    "name": "Nötfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1191,
                    "name": "Cashewnötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1192,
                    "name": "Hasselnötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1194,
                    "name": "Jordnötssmör",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 95,
                    "carbon": {
                        "average": 2.5,
                        "max": 2.5,
                        "min": 2.5
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1197,
                    "name": "Jordnötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1198,
                    "name": "Kastanjer",
                    "gramPerPiece": 11,
                    "gramPerDeciliter": 11,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1200,
                    "name": "Kokosflingor",
                    "gramPerPiece": 5,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1201,
                    "name": "Kokosmjölk",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1203,
                    "name": "Kokosnöt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1205,
                    "name": "Linfrön",
                    "gramPerPiece": 10,
                    "gramPerDeciliter": 65,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1206,
                    "name": "Mandelmassa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1207,
                    "name": "Paranötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1208,
                    "name": "Pekannötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1209,
                    "name": "Pistaschnötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1210,
                    "name": "Pumpafrön",
                    "gramPerPiece": 9,
                    "gramPerDeciliter": 59,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1211,
                    "name": "Sesamfrön",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1213,
                    "name": "Solrosfrön",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1215,
                    "name": "Valnötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1216,
                    "name": "Druvkärnolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1218,
                    "name": "Hampfröolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1219,
                    "name": "Kokosfett",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 90,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1220,
                    "name": "Linfröolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1221,
                    "name": "Majsolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1222,
                    "name": "Olivolja",
                    "gramPerPiece": 93,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 1.75,
                        "max": 2.2,
                        "min": 1.3
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1224,
                    "name": "Palmolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0.3,
                        "max": 0.3,
                        "min": 0.3
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1225,
                    "name": "Rapsolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0.8,
                        "max": 0.8,
                        "min": 0.8
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1227,
                    "name": "Sesamolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1228,
                    "name": "Sojaolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1229,
                    "name": "Solrosolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1230,
                    "name": "Tistelolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1231,
                    "name": "Vetegroddsolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1232,
                    "name": "Brieost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1234,
                    "name": "Camembert",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1237,
                    "name": "Fetaost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1240,
                    "name": "Färskost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1247,
                    "name": "Getost chèvre",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1248,
                    "name": "Grönmögelost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1249,
                    "name": "Halloumiost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1251,
                    "name": "Keso färskost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1253,
                    "name": "Kvarg färskost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1255,
                    "name": "Margarinost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1257,
                    "name": "Mesost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1261,
                    "name": "Messmör",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 95,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1269,
                    "name": "Mozzarella",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 7.28,
                        "max": 7.28,
                        "min": 7.28
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1270,
                    "name": "Ost hårdost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1282,
                    "name": "Parmesanost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1283,
                    "name": "Vassle",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 104,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1284,
                    "name": "Ädelost grönmögelost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1286,
                    "name": "Couscous",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 80,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 28
                },
                {
                    "id": 1288,
                    "name": "Pasta glutenfri",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 28
                },
                {
                    "id": 1294,
                    "name": "Pasta",
                    "gramPerPiece": 70,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0.66,
                        "max": 0.66,
                        "min": 0.66
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 28
                },
                {
                    "id": 1313,
                    "name": "Risnudlar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 28
                },
                {
                    "id": 1316,
                    "name": "Tagliatelle",
                    "gramPerPiece": 57,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 28
                },
                {
                    "id": 1318,
                    "name": "Tortellini",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 28
                },
                {
                    "id": 1320,
                    "name": "Äggnudlar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 28
                },
                {
                    "id": 1334,
                    "name": "Inova",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1340,
                    "name": "Kroppkakor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1342,
                    "name": "Lök",
                    "gramPerPiece": 100,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1346,
                    "name": "Morot",
                    "gramPerPiece": 100,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.14,
                        "max": 0.14,
                        "min": 0.14
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1348,
                    "name": "Pitepalt",
                    "gramPerPiece": 100,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1349,
                    "name": "Pommes frites",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1352,
                    "name": "Potatis",
                    "gramPerPiece": 40,
                    "gramPerDeciliter": 65,
                    "carbon": {
                        "average": 0.08,
                        "max": 0.14,
                        "min": 0.01
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1362,
                    "name": "Potatisbullar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.01,
                        "max": 0.01,
                        "min": 0.01
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1369,
                    "name": "Potatiskroketter",
                    "gramPerPiece": 7,
                    "gramPerDeciliter": 54,
                    "carbon": {
                        "average": 0.01,
                        "max": 0.01,
                        "min": 0.01
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1387,
                    "name": "Rödbeta",
                    "gramPerPiece": 40,
                    "gramPerDeciliter": 72,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1389,
                    "name": "Sojabiff",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.72,
                        "max": 0.72,
                        "min": 0.72
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1390,
                    "name": "Solist",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1393,
                    "name": "Swift",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1396,
                    "name": "Avorio ris",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 3.1,
                        "max": 3.1,
                        "min": 3.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1397,
                    "name": "Basmatiris",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 3.1,
                        "max": 3.1,
                        "min": 3.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1399,
                    "name": "Bovete",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 75,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1400,
                    "name": "Bovetegröt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1401,
                    "name": "Bulgur",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 80,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1404,
                    "name": "Dinkel",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1407,
                    "name": "Fiberhavregryn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1408,
                    "name": "Grötris",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1410,
                    "name": "Havregryn fullkorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1411,
                    "name": "Havrekli",
                    "gramPerPiece": 5,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1413,
                    "name": "Hirs fullkorn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1414,
                    "name": "Jasminris",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 3.1,
                        "max": 3.1,
                        "min": 3.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1417,
                    "name": "Korngryn",
                    "gramPerPiece": 5,
                    "gramPerDeciliter": 35,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1418,
                    "name": "Kruskakli",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1419,
                    "name": "Majsgryn polenta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1420,
                    "name": "Mannagryn",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 70,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1422,
                    "name": "Quinoa röd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1424,
                    "name": "Ris långkornigt",
                    "gramPerPiece": 75,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 3.1,
                        "max": 3.1,
                        "min": 3.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1428,
                    "name": "Ris rundkornigt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 3.1,
                        "max": 3.1,
                        "min": 3.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1429,
                    "name": "Vildris",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 3.1,
                        "max": 3.1,
                        "min": 3.1
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1443,
                    "name": "Vetegroddar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1444,
                    "name": "Vetekli",
                    "gramPerPiece": 3,
                    "gramPerDeciliter": 20,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1447,
                    "name": "Smör",
                    "gramPerPiece": 25,
                    "gramPerDeciliter": 95,
                    "carbon": {
                        "average": 6.5,
                        "max": 6.5,
                        "min": 6.5
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 31
                },
                {
                    "id": 1449,
                    "name": "Brun farin",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1450,
                    "name": "Druvsocker",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 90,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1451,
                    "name": "Fruktsocker",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 90,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1452,
                    "name": "Honung",
                    "gramPerPiece": 7,
                    "gramPerDeciliter": 140,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1453,
                    "name": "Ljus sirap",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1454,
                    "name": "Socker",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 90,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1455,
                    "name": "Brännvin",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 33
                },
                {
                    "id": 1456,
                    "name": "Gin",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 33
                },
                {
                    "id": 1465,
                    "name": "Apelsinmarmelad",
                    "gramPerPiece": 18,
                    "gramPerDeciliter": 117,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1467,
                    "name": "Björnbärssylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1468,
                    "name": "Blåbärssylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1469,
                    "name": "Hallonsylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1470,
                    "name": "Hjortronsylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1471,
                    "name": "Jordgubbssylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1472,
                    "name": "Krusbärssylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1473,
                    "name": "Körsbärssylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1474,
                    "name": "Lingonsylt",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1476,
                    "name": "Marmelad",
                    "gramPerPiece": 6,
                    "gramPerDeciliter": 95,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1478,
                    "name": "Rödvinbärsgelé",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1479,
                    "name": "Svartvinbärsgelé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1480,
                    "name": "Äppelmos",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 34
                },
                {
                    "id": 1483,
                    "name": "Vatten",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 35
                },
                {
                    "id": 1484,
                    "name": "Mineralvatten",
                    "gramPerPiece": 330,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 35
                },
                {
                    "id": 1486,
                    "name": "Sodavatten",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 35
                },
                {
                    "id": 1489,
                    "name": "Havredryck",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 36
                },
                {
                    "id": 1493,
                    "name": "Sojaglass",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 55,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 36
                },
                {
                    "id": 1494,
                    "name": "Tofu sojabönsost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 2,
                        "max": 2,
                        "min": 2
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 36
                },
                {
                    "id": 1497,
                    "name": "Quorn svampprotein färs bitar filé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 3.7,
                        "max": 4,
                        "min": 3.4
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 37
                },
                {
                    "id": 1498,
                    "name": "Vegebitar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 37
                },
                {
                    "id": 1499,
                    "name": "Vegetarisk färs sojaprotein",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 85,
                    "carbon": {
                        "average": 0.72,
                        "max": 0.72,
                        "min": 0.72
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 37
                },
                {
                    "id": 1503,
                    "name": "Rödvin",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 38
                },
                {
                    "id": 1507,
                    "name": "Vitt vin",
                    "gramPerPiece": 150,
                    "gramPerDeciliter": 102,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 38
                },
                {
                    "id": 1512,
                    "name": "Ägg",
                    "gramPerPiece": 57,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 2.12,
                        "max": 4.6,
                        "min": 0.97
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 39
                },
                {
                    "id": 1515,
                    "name": "Öl",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 40
                },
                {
                    "id": 1518,
                    "name": "Kondenserad mjölk",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 41
                },
                {
                    "id": 1521,
                    "name": "Mjölkpulver",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 41
                },
                {
                    "id": 1522,
                    "name": "Bakpulver",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1523,
                    "name": "Basilika",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1525,
                    "name": "Chilisås",
                    "gramPerPiece": 17,
                    "gramPerDeciliter": 115,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1526,
                    "name": "Dill",
                    "gramPerPiece": 3,
                    "gramPerDeciliter": 17,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1540,
                    "name": "Fiskbuljongtärning",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1541,
                    "name": "Fiskbuljong",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1542,
                    "name": "Färsk jäst",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1543,
                    "name": "Gelatin",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1545,
                    "name": "Grönsaksbuljongtärning",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1546,
                    "name": "Grönsaksbuljong",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1551,
                    "name": "Hönsbuljongtärning",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1552,
                    "name": "Hönsbuljong",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1553,
                    "name": "Salt",
                    "gramPerPiece": 6,
                    "gramPerDeciliter": 125,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1554,
                    "name": "Kalvbuljong",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1556,
                    "name": "Ketchup",
                    "gramPerPiece": 18,
                    "gramPerDeciliter": 120,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1559,
                    "name": "Köttbuljong",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1561,
                    "name": "Köttbuljongtärning",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1564,
                    "name": "Majonnäs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 1.95,
                        "max": 1.95,
                        "min": 1.95
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1569,
                    "name": "Persilja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1571,
                    "name": "Senap fransk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1572,
                    "name": "Senap svensk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1574,
                    "name": "Sojasås",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1580,
                    "name": "Torrjäst",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1581,
                    "name": "Vinäger",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1582,
                    "name": "Vitlök",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1584,
                    "name": "Ättiksprit",
                    "gramPerPiece": 9,
                    "gramPerDeciliter": 92,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1586,
                    "name": "Hare",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1588,
                    "name": "Hjort bog",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1589,
                    "name": "Hjortfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1590,
                    "name": "Hjort korv",
                    "gramPerPiece": 85,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1591,
                    "name": "Hjort kronhjort",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1592,
                    "name": "Hjort ryggbiff",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1593,
                    "name": "Hjort skav",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1595,
                    "name": "Häst kött",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1596,
                    "name": "Kalv bog",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1597,
                    "name": "Kalv bringa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1598,
                    "name": "Kalvfilé",
                    "gramPerPiece": 1000,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1599,
                    "name": "Kalvfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1600,
                    "name": "Kalvfransyska",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1601,
                    "name": "Kalvhögrev",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1602,
                    "name": "Kalv innanlår",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1603,
                    "name": "Kalvkotlett",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1605,
                    "name": "Kalv kött",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1606,
                    "name": "Kalv lägg",
                    "gramPerPiece": 57,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1607,
                    "name": "Kalvstek",
                    "gramPerPiece": 1500,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1608,
                    "name": "Kalv tunnbringa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1609,
                    "name": "Kalvytterlår",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1610,
                    "name": "Kanin",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1613,
                    "name": "Köttfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 16,
                        "max": 16,
                        "min": 16
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1615,
                    "name": "Lamm bog",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1616,
                    "name": "Lammfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1617,
                    "name": "Lamm kotlett",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1618,
                    "name": "Lammkotlett",
                    "gramPerPiece": 60,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1620,
                    "name": "Lamm lägg",
                    "gramPerPiece": 57,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1621,
                    "name": "Lamm rygg",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1622,
                    "name": "Lammstek",
                    "gramPerPiece": 2000,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1623,
                    "name": "Lamm",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1624,
                    "name": "Lamm tunnbringa",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1625,
                    "name": "Lammrygg lammhals",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 13.35,
                        "max": 13.35,
                        "min": 13.35
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1626,
                    "name": "Ren bog",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1627,
                    "name": "Ren kött kallrökt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1628,
                    "name": "Ren kött",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1631,
                    "name": "Ren skav",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1632,
                    "name": "Ren stek",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1634,
                    "name": "Rådjur bog",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1635,
                    "name": "Rådjur kött",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1637,
                    "name": "Rådjur stek",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1639,
                    "name": "Vildsvin bog",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1640,
                    "name": "Vildsvin filé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1641,
                    "name": "Vildsvin stek",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1642,
                    "name": "Älg skav",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1643,
                    "name": "Älg stek",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1644,
                    "name": "Älg ytterlår",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1645,
                    "name": "Älgfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1646,
                    "name": "Älghögrev",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1647,
                    "name": "Älgryggbiff",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 43
                },
                {
                    "id": 1648,
                    "name": "Vitlöksklyfta",
                    "gramPerPiece": 3,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.23,
                        "max": 0.23,
                        "min": 0.23
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1649,
                    "name": "Olja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1650,
                    "name": "Matolja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 93,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 26
                },
                {
                    "id": 1651,
                    "name": "Mjölk",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 24
                },
                {
                    "id": 1652,
                    "name": "Grädde",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 2.6,
                        "max": 4,
                        "min": 1.2
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 14
                },
                {
                    "id": 1653,
                    "name": "Mjöl",
                    "gramPerPiece": 500,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1654,
                    "name": "Mascarponeost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 40,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1655,
                    "name": "Kycklingklubba",
                    "gramPerPiece": 200,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 1656,
                    "name": "Lövbiff",
                    "gramPerPiece": 125,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1657,
                    "name": "Passerade tomater",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1658,
                    "name": "Romansallad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.7,
                        "max": 0.7,
                        "min": 0.7
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1672,
                    "name": "Peppar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1673,
                    "name": "Ris",
                    "gramPerPiece": 80,
                    "gramPerDeciliter": 80,
                    "carbon": {
                        "average": 2.17,
                        "max": 2.7,
                        "min": 1.8
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1674,
                    "name": "Kryddor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1675,
                    "name": "Fond",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1676,
                    "name": "Timjan",
                    "gramPerPiece": 10,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 4,
                        "max": 4,
                        "min": 4
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1677,
                    "name": "Rosmarin",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1678,
                    "name": "Salt och peppar",
                    "gramPerPiece": 5,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1679,
                    "name": "Garam masala",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1680,
                    "name": "Ingefära",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1681,
                    "name": "Pak Choi",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1682,
                    "name": "Bär",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 1683,
                    "name": "Potatismos",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1684,
                    "name": "Riskakor",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1685,
                    "name": "Saffran",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1686,
                    "name": "Spiskummin",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1687,
                    "name": "Kardemumma",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1688,
                    "name": "Kanel",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1689,
                    "name": "Anis",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1690,
                    "name": "Pesto",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1691,
                    "name": "curry",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1692,
                    "name": "Koriander",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1693,
                    "name": "oregano",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1694,
                    "name": "senapsfrö",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1695,
                    "name": "gurkmeja",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1697,
                    "name": "mynta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1698,
                    "name": "Salvia",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1700,
                    "name": "Mandel",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1701,
                    "name": "chilipulver",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1702,
                    "name": "kapris",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1703,
                    "name": "Lagerblad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1704,
                    "name": "Paprikapulver",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1705,
                    "name": "Körvel",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 424,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1706,
                    "name": "Ruccolasallad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1707,
                    "name": "Svartpeppar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1708,
                    "name": "Balsamvinäger",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1709,
                    "name": "Äggulor",
                    "gramPerPiece": 18,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 39
                },
                {
                    "id": 1710,
                    "name": "Dragon",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1711,
                    "name": "Surdegsbröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 1712,
                    "name": "Parmaskinka",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1713,
                    "name": "Prosciutto",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1714,
                    "name": "Vitpeppar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1715,
                    "name": "Chiafrön",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1716,
                    "name": "Kycklinglårfilé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 12
                },
                {
                    "id": 1717,
                    "name": "Tikka masala",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1718,
                    "name": "Jalapeñopeppar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1719,
                    "name": "Chips",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1720,
                    "name": "Grönsaksfond",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1721,
                    "name": "Kalvfond",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1722,
                    "name": "Fisksås",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1723,
                    "name": "Mörk choklad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1724,
                    "name": "Florsocker",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1725,
                    "name": "Vaniljsocker",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1726,
                    "name": "Vaniljpulver",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1727,
                    "name": "Vaniljstång",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1728,
                    "name": "Marshmallows",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1729,
                    "name": "Flingsalt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1730,
                    "name": "Chutney",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 32
                },
                {
                    "id": 1731,
                    "name": "Salladslök",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1732,
                    "name": "Äggvita",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 39
                },
                {
                    "id": 1733,
                    "name": "Vitvinsvinäger",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1734,
                    "name": "Riven ost",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 27
                },
                {
                    "id": 1735,
                    "name": "äppelcidervinäger",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1736,
                    "name": "Nejlika",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1737,
                    "name": "Tortillabröd",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 6
                },
                {
                    "id": 1738,
                    "name": "Tahini",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1739,
                    "name": "Sweet chili",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1740,
                    "name": "Matvete",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 30
                },
                {
                    "id": 1741,
                    "name": "Muskot",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 42,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1742,
                    "name": "Sambal oelek",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1743,
                    "name": "Oxfärs",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1744,
                    "name": "Grekisk yoghurt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 1745,
                    "name": "Filodeg",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 23
                },
                {
                    "id": 1746,
                    "name": "Turkisk yoghurt",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 100,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 8
                },
                {
                    "id": 1747,
                    "name": "Sötpotatis",
                    "gramPerPiece": 200,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0.41,
                        "max": 0.41,
                        "min": 0.41
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1748,
                    "name": "Hoisinsås",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1749,
                    "name": "Ostronsås",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1750,
                    "name": "Pinjenötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1751,
                    "name": "Smördeg",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 31
                },
                {
                    "id": 1752,
                    "name": "Zucchini",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1753,
                    "name": "Pistagenötter",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 25
                },
                {
                    "id": 1755,
                    "name": "Hjärtsallad",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1756,
                    "name": "Cayennepeppar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1757,
                    "name": "Fänkålsfrön",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1758,
                    "name": "Bratwurst",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 1
                },
                {
                    "id": 1759,
                    "name": "Tabasco",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1760,
                    "name": "Citronskal(zest)",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 11
                },
                {
                    "id": 1761,
                    "name": "Fläskgrytbitar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1762,
                    "name": "Ansjovis",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 1763,
                    "name": "fläskytterfilé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1764,
                    "name": "Bakpotatis",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 29
                },
                {
                    "id": 1765,
                    "name": "Tryffel",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1766,
                    "name": "Mejram",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1767,
                    "name": "Teriyaki",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1768,
                    "name": "Bogfläsk",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                },
                {
                    "id": 1769,
                    "name": "Worchestershire",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 42
                },
                {
                    "id": 1770,
                    "name": "Bönpasta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 5
                },
                {
                    "id": 1771,
                    "name": "Gulbeta",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 15
                },
                {
                    "id": 1772,
                    "name": "Lammkorv",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 44
                },
                {
                    "id": 1773,
                    "name": "Kräftstjärtar",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 1774,
                    "name": "Laxfilé",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 9
                },
                {
                    "id": 1775,
                    "name": "Fläsksida",
                    "gramPerPiece": 0,
                    "gramPerDeciliter": 0,
                    "carbon": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "energy": {
                        "average": 0,
                        "max": 0,
                        "min": 0
                    },
                    "category": 2
                }
            ]
        };
        return a;
    }

    var getCategoryById = function(id){
        c = {"categories":[{"id":1,"name":"n\u00f6tk\u00f6tt","gramPerPiece":117.75,"gramPerDeciliter":0,"carbon":{"average":27.5,"max":43,"min":17},"energy":{"average":0,"max":0,"min":0}},{"id":2,"name":"grisk\u00f6tt","gramPerPiece":100,"gramPerDeciliter":0,"carbon":{"average":5.7,"max":8,"min":4},"energy":{"average":0,"max":0,"min":0}},{"id":4,"name":"bageriprodukter s\u00f6ta eller feta","gramPerPiece":0,"gramPerDeciliter":0,"carbon":{"average":0,"max":0,"min":0},"energy":{"average":0,"max":0,"min":0}},{"id":5,"name":"baljv\u00e4xter","gramPerPiece":0,"gramPerDeciliter":87,"carbon":{"average":0.62,"max":1.4,"min":0.2},"energy":{"average":0,"max":0,"min":0}},{"id":6,"name":"br\u00f6d","gramPerPiece":48,"gramPerDeciliter":52.5,"carbon":{"average":0.75,"max":1.2,"min":0.44},"energy":{"average":0,"max":0,"min":0}},{"id":7,"name":"choklad","gramPerPiece":0,"gramPerDeciliter":85.625,"carbon":{"average":1.93,"max":2.7,"min":0.9},"energy":{"average":0,"max":0,"min":0}},{"id":8,"name":"fil och yoghurt","gramPerPiece":0,"gramPerDeciliter":103,"carbon":{"average":1.38,"max":2.5,"min":0.8},"energy":{"average":0,"max":0,"min":0}},{"id":9,"name":"fisk och skaldjur","gramPerPiece":55,"gramPerDeciliter":73,"carbon":{"average":3.9,"max":7,"min":1.5},"energy":{"average":0,"max":0,"min":0}},{"id":10,"name":"frukostflingor","gramPerPiece":0,"gramPerDeciliter":48,"carbon":{"average":0.3,"max":0.3,"min":0.3},"energy":{"average":0,"max":0,"min":0}},{"id":11,"name":"frukt och b\u00e4r","gramPerPiece":125,"gramPerDeciliter":69,"carbon":{"average":0.47,"max":1.2,"min":0.1},"energy":{"average":0,"max":0,"min":0}},{"id":12,"name":"f\u00e5gel","gramPerPiece":200,"gramPerDeciliter":100,"carbon":{"average":2.78,"max":4,"min":1.7},"energy":{"average":0,"max":0,"min":0}},{"id":13,"name":"glass","gramPerPiece":0,"gramPerDeciliter":55,"carbon":{"average":2.1,"max":2.2,"min":2},"energy":{"average":0,"max":0,"min":0}},{"id":14,"name":"gr\u00e4dde","gramPerPiece":0,"gramPerDeciliter":99,"carbon":{"average":3.44,"max":6,"min":1.2},"energy":{"average":0,"max":0,"min":0}},{"id":15,"name":"gr\u00f6nsaker och svamp","gramPerPiece":15,"gramPerDeciliter":55,"carbon":{"average":2.34,"max":6.5,"min":0.2},"energy":{"average":0,"max":0,"min":0}},{"id":17,"name":"juice och nektar","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":4,"max":7,"min":2},"energy":{"average":0,"max":0,"min":0}},{"id":18,"name":"kaffe te och kakao","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":5,"max":10,"min":2},"energy":{"average":0,"max":0,"min":0}},{"id":19,"name":"konserverad frukt och b\u00e4r","gramPerPiece":40,"gramPerDeciliter":110,"carbon":{"average":0.56,"max":0.92,"min":0.2},"energy":{"average":0,"max":0,"min":0}},{"id":21,"name":"l\u00e4sk","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":0.43,"max":0.49,"min":0.36},"energy":{"average":0,"max":0,"min":0}},{"id":22,"name":"margarin","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":1.58,"max":2.2,"min":1},"energy":{"average":0,"max":0,"min":0}},{"id":23,"name":"mj\u00f6l och st\u00e4rkelse","gramPerPiece":0,"gramPerDeciliter":103,"carbon":{"average":0.55,"max":0.9,"min":0.3},"energy":{"average":0,"max":0,"min":0}},{"id":24,"name":"mj\u00f6lk","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":1.38,"max":2.5,"min":0.8},"energy":{"average":0,"max":0,"min":0}},{"id":25,"name":"n\u00f6tter","gramPerPiece":0,"gramPerDeciliter":57,"carbon":{"average":1.63,"max":2.8,"min":1},"energy":{"average":0,"max":0,"min":0}},{"id":26,"name":"oljor","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":1.68,"max":2.5,"min":0.5},"energy":{"average":0,"max":0,"min":0}},{"id":27,"name":"ost","gramPerPiece":0,"gramPerDeciliter":45,"carbon":{"average":9,"max":11,"min":6},"energy":{"average":0,"max":0,"min":0}},{"id":28,"name":"pasta","gramPerPiece":0,"gramPerDeciliter":59,"carbon":{"average":0.69,"max":0.8,"min":0.57},"energy":{"average":0,"max":0,"min":0}},{"id":29,"name":"potatis och rotfrukt","gramPerPiece":60,"gramPerDeciliter":71,"carbon":{"average":0.36,"max":1,"min":0.1},"energy":{"average":0,"max":0,"min":0}},{"id":30,"name":"ris","gramPerPiece":0,"gramPerDeciliter":71,"carbon":{"average":2.08,"max":3,"min":1.5},"energy":{"average":0,"max":0,"min":0}},{"id":31,"name":"sm\u00f6r","gramPerPiece":0,"gramPerDeciliter":95,"carbon":{"average":8.75,"max":11,"min":6},"energy":{"average":0,"max":0,"min":0}},{"id":32,"name":"socker honung och sirap","gramPerPiece":7,"gramPerDeciliter":102,"carbon":{"average":1.48,"max":4,"min":0.4},"energy":{"average":0,"max":0,"min":0}},{"id":33,"name":"sprit","gramPerPiece":0,"gramPerDeciliter":0,"carbon":{"average":1.7,"max":1.7,"min":1.7},"energy":{"average":0,"max":0,"min":0}},{"id":34,"name":"sylt och marmelad","gramPerPiece":0,"gramPerDeciliter":112,"carbon":{"average":4,"max":7,"min":2},"energy":{"average":0,"max":0,"min":0}},{"id":35,"name":"vatten","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":0,"max":0,"min":0},"energy":{"average":0,"max":0,"min":0}},{"id":36,"name":"vegetariskt mejeri","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":0.25,"max":0.25,"min":0.25},"energy":{"average":0,"max":0,"min":0}},{"id":37,"name":"vegetariskt k\u00f6tt","gramPerPiece":100,"gramPerDeciliter":85,"carbon":{"average":3.83,"max":5,"min":2.5},"energy":{"average":0,"max":0,"min":0}},{"id":38,"name":"vin","gramPerPiece":700,"gramPerDeciliter":100,"carbon":{"average":1.7,"max":1.7,"min":1.7},"energy":{"average":0,"max":0,"min":0}},{"id":39,"name":"\u00e4gg","gramPerPiece":57,"gramPerDeciliter":0,"carbon":{"average":2.12,"max":4.6,"min":0.97},"energy":{"average":0,"max":0,"min":0}},{"id":40,"name":"\u00f6l","gramPerPiece":500,"gramPerDeciliter":100,"carbon":{"average":1.7,"max":1.7,"min":1.7},"energy":{"average":0,"max":0,"min":0}},{"id":41,"name":"\u00f6vrig mejeri","gramPerPiece":0,"gramPerDeciliter":100,"carbon":{"average":2.67,"max":5,"min":1},"energy":{"average":0,"max":0,"min":0}},{"id":42,"name":"\u00f6vrigt","gramPerPiece":11,"gramPerDeciliter":90,"carbon":{"average":1,"max":1,"min":1},"energy":{"average":0,"max":0,"min":0}},{"id":43,"name":"\u00f6vrigt k\u00f6tt","gramPerPiece":150,"gramPerDeciliter":0,"carbon":{"average":0.5,"max":0.5,"min":0.5},"energy":{"average":10,"max":10,"min":10}},{"id":44,"name":"lammk\u00f6tt","gramPerPiece":150,"gramPerDeciliter":0,"carbon":{"average":26.75,"max":38,"min":15},"energy":{"average":0,"max":0,"min":0}},{"id":45,"name":"Kryddor","gramPerPiece":0,"gramPerDeciliter":0,"carbon":{"average":0,"max":0,"min":0},"energy":{"average":0,"max":0,"min":0}}]};
        cat = c["categories"];
        var len = cat.length;
        for (var i = 0; i < len; i++){
            if (cat[i]["id"] == id){
                return cat[i];
            }
        }
        return undefined;
    }

    
    var calcTwo = function(jsonFile) {
        var settings = {
            "name" : "Varugrupp",//8, //"H",
            "massUnit" : "Fsgenhet", //4,//"D",
            "quantity" : "Total kvantitet", // 18,//"R",
            "organization" : "Orgenhetstyp",
            "unit" : "Enhet" //24//"Y"
        };

        globalFoodLib = getFoodDict();

        var foodLib = getFoodDict();

        var rowList = arrangeData(jsonFile, settings); //returns a list of rows, with just the needed data.

        var unitList = arrangeByUnit(rowList); //returns a list of units, which all contain a foodDict-object filled with food

        return unitList;
    }
    var fileCalced = []

    this.readFile = function (file) {
        /*reads file, calls papaparse in order to get the file as json. calls the calc-function with the jsonFile */
        //file = document.getElementById("myFile").files[0];
        var settings = {
            "name" : "Varugrupp",//8, //"H",
            "massUnit" : "Fsgenhet", //4,//"D",
            "quantity" : "Total kvantitet", // 18,//"R",
            "organization" : "Orgenhetstyp",
            "unit" : "Enhet" //24//"Y"
        };
     
    	
        Papa.parse(file, { //csv --> json
            header: true,
            dynamicTyping: true,
            encoding : "UTF-8",
            complete: function(jsonFile) {
                //calc(jsonFile,settings); //Calls calc
           
                this.globalSettings = settings;
                fileCalced = calcTwo(jsonFile, settings);
                $cookieStore.put("fileCalced", fileCalced);
            }
  			});
    }
    //Returnerar alla kalkylerade items från filuppladdningen
    this.getFileCalced = function() {
    	return fileCalced;
    }

    //returnerar totala utsläppet hos en fil
    this.getTotalEmission = function() {
    	var emission = 0;
    	for (enhet in fileCalced) {
    		emission += fileCalced[enhet].carbon.total;
    	}
    	return emission;
    }

    //Returnerar ett speciefikt objekt för detalj sidan.
    this.getItemCalced = function(name) {
    	for (item in fileCalced) {
    		if (name == fileCalced[item].name) {
    			return fileCalced[item];
    		}
    	}
    }
    

    
	//Hämtar kakorna
	getCookieList();
	getCookiefile();

	return this;
});