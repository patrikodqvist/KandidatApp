kolCalc.controller('inputCalc', function ($scope,calc) {
	//Menyn av alla items
	$scope.List =  function() {
		return calc.getList();
	}

	//Hämtar alla sökresultat
	$scope.search = function(name) {
		var x = calc.returnCat();
		if (x.length == 0) {
			calc.getCategory.get({}, function(output){
			calc.cat=output.categories;
		});
		}
		calc.getIngredient.get({name:name}, function(output) {
			$scope.searchResults = output.ingredients;
			$scope.status = "Fick " + output.ingredients.length + " resultat på sökningen " + name;
		}, function(output){
			$scope.status = "Finns inget med sökningen " + name;
		});
	}

	//Beräknar C02 utsläppen
	$scope.ingCalculate = function(id,amount,unit, category) {
		amount = parseFloat(amount);
		calc.calcIng.get({id:id,amount:amount,unit:unit}, function(output){
			item = output;
			item["cat"] = category;
			calc.addToList(output);
		});
	}

	//Tar bort ett item från menyn
	$scope.removeItem = function(id) {
		calc.removeItem(id);
	}

	//Tar fram totala C02 från alla i menyn
	$scope.calcTotalCo2 = function() {
		return calc.calcTotalCo2();
	}

	//lägger in alla items i rätt kategori
	$scope.categoryList = function() {
		calc.chartCalcLoad = false;
		var list = calc.returnCat();
		calc.createCategories(list);
        var items = calc.getList();
        for (item in items) {
            calc.addCategory(items[item]);
        }
    }
});






