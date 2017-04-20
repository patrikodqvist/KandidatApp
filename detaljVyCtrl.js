kolCalc.controller('detaljVy', function($scope, $routeParams, calc) {
	if (calc.load == false) {
		var item = calc.getItemCalced($routeParams.name);
		if (item) {
			$scope.TotUt = item.carbon.total;
			$scope.enhet = item.name;
			$scope.list = calc.getFileCalced();
			//Graf inställningar
	         hbarObj = { 
	            "type":"hbar",
	            "plot": {"stacked": true},  
	            "title":{  
	                "text":"Utsläpp per Kategori",
	            },
	            "scale-x": {"values":["Totalt C02 Utsläpp"]},
	            "height": "100%",
	            "width": "100%",
	            "legend":{
	            	"margin-right":"0px",
	            	 "layout":"6x4", //row x column
    				"x":"5%",
    				"y":"70%",    
	            },  
	            "plotarea":{
	                "margin-bottom": "40%"
	            },    
	            "item":{  
	                    "offset-x":"10px" }, 
	            "series":[]
	        }
	        ringObj = { 
	            "type":"ring",  
	            "title":{  
	                "text":"Fördelning mellan Kategorierna",
	                "margin-right": "50px"
	            },
	            "legend":{
	            	"margin-right":"0px"  
	            },  
	            "plotarea":{
	            	"margin-right": "100px"
	            
	            },    
	            "item":{  
	                    "offset-x":"10px" }, 
	            "series":[]
	        }

	        for (category in item.categoryList) {
	        	hbarObj.series.push({"values": [item.categoryList[category].carbon.total], "text": [item.categoryList[category].name]});
	        	ringObj.series.push({"values": [item.categoryList[category].carbon.total], "text": [item.categoryList[category].name]});
	        }
        	zingchart.render({ 
			id : "hBar", 
			data : hbarObj, 
			height: "100%", 
			width: "95%"});

			zingchart.render({ 
			id : "ringBar", 
			data : ringObj, 
			height: "100%", 
			width: "95%"});

			calc.load = true;
		}
	}


	
	$scope.changeState = function() {
		calc.load = false;
		calc.fileChartLoad = false;
	}
});