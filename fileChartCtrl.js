kolCalc.controller('fileChart', function($scope,calc) {

	if (calc.fileChartLoad == false) {
		var list = calc.getFileCalced();
		$scope.list = list;
		$scope.utslapp = calc.getTotalEmission();

		ringChartSettings = { 
          "type":"ring",  
            "title":{  
                "text":"Fördelning mellan Enheter",
                "margin-left": "50px"

            },
            "legend":{
            	  "margin-right": "0px",
            	  "padding-right": "15px",
            },  
            "plotarea":{
                "margin-left":"125px"
            },    
            "item":{  
                    "offset-x":"10px" }, 
            "series":[]}

		for (enhet in list) {
			if (list[enhet].carbon.total > 0) {
				ringChartSettings.series.push({"values": [list[enhet].carbon.total], "text": list[enhet].name});
			}
		}

		$scope.ringChartSettings = ringChartSettings;

		zingchart.render({ 
			id : "ringbar", 
			data : ringChartSettings, 
			height: "100%", 
			width: "80%"});
		calc.fileChartLoad = true;
		}

		$scope.changeState = function() {
			calc.fileChartLoad = false;
			calc.load = false;
	}

});