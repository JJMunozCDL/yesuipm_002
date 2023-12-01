sap.ui.define([
	], function () {
		"use strict";
		return {
			
			getUTCDate : function(oDate) {
				return new Date(Date.UTC(oDate.getFullYear(), oDate.getMonth(), oDate.getDate()));
			},
								
			parseError: function(oError){
				var sAllMessages = "";
				
				try {
					// try to cast oLogEntry message as a JSON Object
					var oJSONMessage = JSON.parse(oError);
				    var sMessage = oJSONMessage.error.message.value;
				}catch(oException){}
				
				if(sMessage === undefined){
					return;
				}
				
				var aErrorDetails = oJSONMessage.error.innererror.errordetails;
				if(aErrorDetails === undefined){
					return sMessage;
				}
				var aFilteredErrors = new Array();
				
				for(var x = 0, len = aErrorDetails.length; x < len; x++){
					for(var y = 0, lenY = aFilteredErrors.length, bDuplicado = false; y < lenY && !bDuplicado; y++){
						if(aErrorDetails[x].message === aFilteredErrors[y].message)
							bDuplicado = true;
					}
					if(!bDuplicado) aFilteredErrors.push(aErrorDetails[x]);
				}
				
				for(var x = 0, len = aFilteredErrors.length; x < len; x++){
					
					if(aFilteredErrors[x].message !== "")
						var sSeparator = sAllMessages !== "" ? "\n" : "";
						sAllMessages =  sAllMessages + sSeparator + aFilteredErrors[x].message;
				}
				
				return sAllMessages;
			},			
			
			getBatchResponse : function(oData) {
				return oData.__batchResponses[0].__changeResponses;
			},
			
		};
});
