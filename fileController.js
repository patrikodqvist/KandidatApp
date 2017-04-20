kolCalc.controller('FileUpload', function ($scope,calc) {
	$scope.installCategories = function() {
		calc.getCategory.get({}, function(output){
			calc.createCategories(output.categories);
			calc.cat=output.categories;
		});

	}

	$scope.readFile = function() {
		file = document.getElementById("myFile").files[0];
		calc.filename = file.name;
		calc.readFile(file);
		
	}
});