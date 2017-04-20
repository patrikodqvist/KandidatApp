kolCalc.controller('homeCtrl', function ($scope,calc) {
	if (calc.hameLoad==false) {
		$scope.kalkylator = calc.getList();
		calc.homeload=true;
		$scope.filename = calc.filename;

	}
	$scope.changeState = function() {
		calc.homeload=false;
	}
});