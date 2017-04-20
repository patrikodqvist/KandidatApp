kolCalc.controller('chartCalc', function ($scope,calc) {
    //Funktion för att skapa diagramen
     $scope.chart = function() {
        //Ingrediens koldioxidgrafen
        var data = calc.calcItems();

        //Graf inställningar
        $scope.BarChartSettings = { 
        "type":"hbar",  
        "title":{  
            "text":"Utsläpp per Ingrediens",
            "margin-left":"10px"  
        },
        "plotarea":{
            "margin-left":"125px"
        },  
        "scale-x":{  
            "values": data[0]  
        },  
        "plot":{  

        },  
        "scale-y":{  

        },
        "item":{  
                "offset-x":"10px"},
        "series":[  
        {"values": data[1]}]}

        //Kategori Grafen
        var catList = calc.calcCategories();

        //Graf inställningar
         object = { 
            "type":"hbar",
            "plot": {"stacked": true},  
            "title":{  
                "text":"Utsläpp per Kategori",
            },
            "scale-x": {"values":["Totalt C02 Utsläpp"]},
            "height": "100%",
            "width": "100%",
            "legend":{  
            },  
            "plotarea":{
                "margin-left":"125px"
            },    
            "item":{  
                    "offset-x":"10px" }, 
            "series":[]};

        ringObject = { 
            "type":"ring",  
            "title":{  
                "text":"Fördelning mellan Kategorierna",
                "margin-right": "50px"
            },
            "legend":{  
            },  
            "plotarea":{
                "margin-left":"125px"
            },    
            "item":{  
                    "offset-x":"10px" }, 
            "series":[]};

        for (i in catList[1]) {
            object.series.push({"values": [catList[1][i]], "text": catList[0][i]});
            ringObject.series.push({"values": [catList[1][i]], "text": catList[0][i]});
        }

        $scope.BarChartSettingstwo = object;
        $scope.ringChartSettings = ringObject;
        calc.chartCalcLoad = true;
    }

    //Hämtar totala utsläppet
    $scope.getCol = function() {
        return calc.calcTotalCo2();
    }

    //Hämtar alla ingredienser
    $scope.List =  function() {
        return calc.getList();
    }
    //Tar bort ett item från menyn
    $scope.removeItem = function(id, object) {
        calc.removeItem(id);
        calc.deleteItemCategory(object);
        $scope.chart();

    }
    //Ser till så att scriptet körs en gång
    if (calc.chartCalcLoad == false) {
        $scope.chart();
         calc.chartCalcLoad = true;
    }

    //Testar om sidan har refreshat och nollställer för om man vill gå bakåt.
    $scope.installCategories = function() {
        calc.chartCalcLoad = false;
        var x = calc.returnCat();
        if (x.length == 0) {
            calc.getCategory.get({}, function(output){
                calc.createCategories(output.categories);
                calc.cat=output.categories;
            });
        }
}});