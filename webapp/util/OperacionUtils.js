sap.ui.define([
	"sap/ui/model/odata/type/Time",
	"es/cdl/yesui5pm002/util/moment",
	], function (Time) {
		"use strict";
		return {
						
			getPriority : function(oOperacion, moment) {
				if(!oOperacion) return;
				return oOperacion.FechaInicio && oOperacion.FechaFin && 
					   oOperacion.HoraInicio  && 
					   oOperacion.HoraFin /*&& oOperacion.Observacion !== '' */ ? 'Low' : 'Medium';
			},
			
			getTextoOperacion : function(oFechaInicio, oFechaFin, oHoraInicio, oHoraFin){
				
				var sMessage = "";
				
				
				/* Añadimos texto fecha notificación: Si es la misma fecha inicio/fin no duplicamos */
				if(oFechaInicio && oFechaFin){
					if(oFechaInicio.getDate() === oFechaFin.getDate() &&
					   oFechaInicio.getMonth() === oFechaFin.getMonth() &&
					   oFechaInicio.getFullYear() === oFechaFin.getFullYear()){
						sMessage = moment(oFechaInicio).format('ll');
					}else{
						sMessage = moment(oFechaInicio).format('ll') + " / " + moment(oFechaFin).format('ll');
					}
				}else if(oFechaInicio){
					sMessage = moment(oFechaInicio).format('ll');
				}else{
					/* Si no existe fecha inicio/fin devolvemos vacio */
					return sMessage;
				}
				
				var oTime = new Time();
				sMessage += " | ";
				
				if(oHoraInicio)
					sMessage += "Inicio: " + oTime.formatValue(oHoraInicio, "string");
				
				if(oHoraFin)
					sMessage += " - Fin: " + oTime.formatValue(oHoraFin, "string");
				
				return sMessage;

			},

			formatDateTime: function(oFecha, oHora){
				var oTime = new Time();
				return ""+moment(oFecha).format('ll')+" "+oTime.formatValue(oHora, "string");
			},

			isTareaIniciada : function(oFechaInicio, oFechaFin, oHoraInicio, oHoraFin){
				if(oFechaInicio && oHoraInicio && !oFechaFin && !oHoraFin){
					return true;
				}
				return false;
			},
			
			isTareaFinalizada : function(oFechaInicio, oFechaFin, oHoraInicio, oHoraFin){
				if(oFechaInicio && oFechaFin && oHoraInicio && oHoraFin){
					return true;
				}
				return false;
			},
						
		}
});
