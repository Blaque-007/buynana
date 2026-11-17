const express = require('express');
const service = require('../services/forecastService');
const router = express.Router();
router.get('/history',(_req,res)=>{
  try {const data=service.getMonthlyFinancialHistory();res.json({success:true,count:data.length,data});}
  catch(error){console.error(error);res.status(500).json({success:false,error:'Unable to retrieve financial history'});}
});
router.get('/prediction',(_req,res)=>{
  try {res.json({success:true,data:service.generateFinancialForecast()});}
  catch(error){console.error(error);res.status(500).json({success:false,error:'Unable to calculate prediction'});}
});
router.get('/suggestions',(_req,res)=>{
  try {res.json({success:true,data:service.getForecastSuggestions()});}
  catch(error){console.error(error);res.status(500).json({success:false,error:'Unable to retrieve forecast suggestions'});}
});
router.post('/hybrid',(req,res)=>{
  try{
    const body=req.body??{};
    const allowed=['expectedIncome','expectedExpenses','expectedSavings'];
    for(const field of allowed){const value=body[field];if(value!==undefined&&value!==null&&
      (typeof value!=='number'||!Number.isFinite(value)||value<0))return res.status(400).json({success:false,error:`${field} must be a non-negative number or null`});}
    if(body.months!==undefined&&(!Number.isInteger(body.months)||body.months<1||body.months>12))
      return res.status(400).json({success:false,error:'months must be an integer between 1 and 12'});
    if(body.confirmBudget!==undefined&&typeof body.confirmBudget!=='boolean')
      return res.status(400).json({success:false,error:'confirmBudget must be a boolean'});
    const data=service.calculateHybridForecast({expectedIncome:body.expectedIncome??null,
      expectedExpenses:body.expectedExpenses??null,expectedSavings:body.expectedSavings??null,
      months:body.months??3,confirmBudget:body.confirmBudget??false});
    return res.json({success:true,data});
  }catch(error){console.error(error);res.status(500).json({success:false,error:'Unable to calculate hybrid forecast'});}
});
module.exports=router;
