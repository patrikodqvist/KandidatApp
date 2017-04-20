var kolCalc = angular.module('kolCalc', ['ngRoute','ngResource', 'zingchart-angularjs', 'ngCookies', 'ngPapaParse']);


kolCalc.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/start', {
        templateUrl: 'partials/start.html'
      }).
      when('/home', {
        templateUrl: 'partials/home.html',
        controller: 'homeCtrl'
      }).
      when('/calc', {
      	templateUrl: 'partials/calc.html',
      	controller: 'inputCalc'
      }).
      when('/studie', {
      	templateUrl: 'partials/studie.html'
      }).
      when('/omOss', {
      	templateUrl: 'partials/omoss.html'
      }).
      when('/charts', {
      	templateUrl: 'partials/chart.html',
      	controller: 'chartCalc'
      }).
      when('/filecharts', {
        templateUrl: 'partials/fileChart.html',
        controller: 'fileChart'
      }).
      when('/detaljvy/:name', {
        templateUrl: 'partials/detaljvy.html',
        controller: 'detaljVy'
      }).
      otherwise({
        redirectTo: '/start'
      });
  }]);





