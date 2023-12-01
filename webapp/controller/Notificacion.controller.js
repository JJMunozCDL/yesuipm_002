 sap.ui.define([
     "es/cdl/yesui5pm002/controller/BaseController",
     "sap/ui/model/json/JSONModel",
     "sap/ui/model/Filter",
     "sap/ui/model/odata/type/Time",
     "sap/m/MessageBox",
     "sap/m/MessageToast",
     "es/cdl/yesui5pm002/util/Utils",
     "es/cdl/yesui5pm002/util/OperacionUtils",
     ], function(BaseController, JSONModel, Filter, Time, MessageBox, MessageToast, Utils, OperacionUtils){
	
	"use strict";

	return BaseController.extend("es.cdl.yesui5pm002.controller.Notificacion", {
		
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
				
		utils: Utils,
		operacionUtils: OperacionUtils,
		
		onInit : function() {
						
			var oRepuestosModel = new JSONModel({
				repuestos: new Array(),
				selectedItem: {}
			});

			
			this.setModel(new JSONModel(), 	'viewModel');	
			this.setModel(new JSONModel(), 	'motivosModel');
			this.setModel(new JSONModel(), 	'operacionesModel');	
			this.setModel(new JSONModel(), 	'notificacionesModel');	
			this.setModel(new JSONModel(), 	'repuestosHistoricoModel');	
			this.setModel(new JSONModel(), 	'procesoNotificacionModel');
			this.setModel(new JSONModel(), 	'repuestosMatchCodeModel');
			this.setModel(oRepuestosModel,  'repuestosModel');
			
			/* Este modelo (YA NO) viene desde el launchpad donde se guarda la notificación temporal (la mostramos en el unifiedShell)
				TODO Fiori KPIS
			*/
			 this.setModel(new JSONModel(), 	'notificacionTemporalModel');
						
			this._oDialogoTarea = sap.ui.xmlfragment("es.cdl.yesui5pm002.view.fragment.DialogoTarea", this);
            this._oDialogoOrden = sap.ui.xmlfragment("es.cdl.yesui5pm002.view.fragment.DialogoOrden", this);			
            this._oDialogoCrearRepuesto = sap.ui.xmlfragment("es.cdl.yesui5pm002.view.fragment.DialogoCrearRepuesto", this);
			this._oBusyDialogNotificacion = sap.ui.xmlfragment("es.cdl.yesui5pm002.view.fragment.BusyDialogNotificacion", this);
			
			this.getView().addDependent(this._oDialogoTarea);
			this.getView().addDependent(this._oDialogoOrden);
			this.getView().addDependent(this._oDialogoCrearRepuesto);
			this.getView().addDependent(this._oBusyDialogNotificacion);

		

		},
		
		onAfterRendering:function(){
			var oCData = this.getOwnerComponent().getComponentData();
			this._resetModels();
			//this._setOrden("800863");
			
			//return;
			if (oCData){

				if (oCData.startupParameters.Pernr !== undefined){
					if(oCData.startupParameters.Pernr[0] !== ""){
						this.sPernr = oCData.startupParameters.Pernr[0];
					}else{
						this.onNavBack();	
					}
				}
				if (oCData.startupParameters.Aufnr !== undefined){
					if(oCData.startupParameters.Aufnr[0] !== ""){
						this._setOrden(oCData.startupParameters.Aufnr[0]);
						return;
					}else{
						this.onNavBack();	
					}
				}
			}

			if(this.sOrden === undefined || this.sOrden === ""){
			//	this._oDialogoOrden.open();
			}
			
		},
		
        onCancelarOrden : function(oEvent){
        	this._onCloseDialogoCambiarOrden();
        },
        
        onSearchRepuesto : function(oEvent){
        	var sQuery = oEvent.getParameter('query');
        	var oList = sap.ui.getCore().byId('listRepuestos');
        	var oBinding = oList.getBinding('items');
        	
        	oBinding.filter([
        		new Filter({
        			and: false,
        			filters: [
        				new Filter({
                			path: 'Matnr',
                			operator: 'Contains',
                			value1: sQuery
                		}),
                		new Filter({
                			path: 'Maktx',
                			operator: 'Contains',
                			value1: sQuery
                		})
        			]
        		})
        		
        	])
        },
                
		onAceptarOrden: function(oEvent){
			
		   var oModel = this.getModel();
		   var oViewModel = this.getModel('viewModel');
						
		   var sOrden = oViewModel.getProperty("/orden");
		   if (sOrden === ""){
   				MessageToast.show(this.getResourceBundle().getText('ordenVacio'),{
						width: '30em'
					});
				return;
		   }
		   var oOrden = oModel.getObject("/OrdenesSet('" + sOrden + "')");
	           
           oViewModel.setProperty("/cargandoOrden", true);			 
            
            /* Si existe la orden no se lanza el dataReceived por lo que obtenemos las operaciones */
           if(oOrden){
           	   oViewModel.setProperty("/ordenCargada", true);
               oViewModel.setProperty("/cargandoOrden", false);
               this._oDialogoOrden.close();
               this._setOrden(oOrden.Aufnr);
               
           }else{
        	   oModel.read("/OrdenesSet('" + sOrden + "')", {
        		   success: (oData) => {
        			   this._oDialogoOrden.close();
        			   this._setOrden(oData.Aufnr);
        		   },
        		   error: (oError) => {
					   var sMessage = Utils.parseError(oError.responseText);
					   MessageBox.error(sMessage);
					   oViewModel.setProperty("/cargandoOrden", false);
        			   oViewModel.setProperty("/stateOrden","Error");
        		   }
        	   })
           }
	             
       },
		
       onCloseNotificacion : function(oEvent){
			var oOperacionesModel = this.getModel('operacionesModel');
			var oBindingContext = oEvent.getSource().getBindingContext('operacionesModel');
			var sPath = oBindingContext.getPath();
			oOperacionesModel.setProperty(sPath + "/Error", false);
			oOperacionesModel.setProperty(sPath + "/ErrorMessage", '');
			oOperacionesModel.setProperty(sPath + "/Notificada", false);
		},
		
		onPressNotificar : function(oEvent){
			var oModel = this.getModel();
			var oViewModel = this.getModel('viewModel');
			var oOperacionesModel = this.getModel('operacionesModel');
		 	var oProcesoNotificacionModel = this.getModel('procesoNotificacionModel');
		 	var oRepuestosModel = this.getModel('repuestosModel');
		 	
		 	var oRepuestos = oRepuestosModel.getProperty("/repuestos");

		 	var oOperaciones = oOperacionesModel.getProperty("/");
			var oTime = new Time();
						
			var sWerks = this.getView().getBindingContext().getProperty("Werks");
			
			this._resetProcesoNotificacion();
			
			for (var i = 0; i < oOperaciones.length; i++) {
				
				var oOperacion = oOperaciones[i];
				var oFechaInicio = undefined;
				var oFechaFin = undefined;
				
				if(oOperacion.FechaInicio && oOperacion.FechaFin && 
				   oOperacion.HoraInicio  && oOperacion.HoraFin &&
				   !oOperacion.Notificada && !oOperacion.Error){
					
					oFechaInicio = Utils.getUTCDate(oOperacion.FechaInicio);				
					oFechaFin = Utils.getUTCDate(oOperacion.FechaFin);
					
					oModel.createEntry("/NotificarSet", {
						properties: {
							PersNo 			: this.sPernr,
							Orderid 		: oOperacion.Orden,
							Operation 		: oOperacion.Activity,
							Complete 		: oOperacion.Completada,
							ExecStartDate 	: oFechaInicio,
							ExecStartTime 	: oOperacion.HoraInicio,
							ExecFinDate 	: oFechaFin,
							ExecFinTime 	: oOperacion.HoraFin,					
							TiniLines 		: oOperacion.Observacion,
							Grund			: oOperacion.Motivo,
							Werks			: sWerks
						},
						success: function(oData, oResponse){
							var sPath = this._getOperacionPathById(oData.Operation);
							if(oData.ErrorMsg !== ''){ // ERROR
								oOperacionesModel.setProperty(sPath + "/ErrorMessage", oData.ErrorMsg);	
								oOperacionesModel.setProperty(sPath + "/Notificada", false);
								oOperacionesModel.setProperty(sPath + "/Error", true);	
							}else{ // SUCCESS
								oOperacionesModel.setProperty(sPath + "/Notificada", true);
								oOperacionesModel.setProperty(sPath + "/Error", false);
								oOperacionesModel.setProperty(sPath + "/ErrorMessage", '');
							}
						}.bind(this),
						error: function(oError) {}.bind(this)
					});
				
				}
			}
			
			var iRepuestosPendientes = oRepuestosModel.getProperty("/repuestos").length;
			oProcesoNotificacionModel.setProperty("/mostrarRepuestos", iRepuestosPendientes > 0);
			
			if(!oModel.hasPendingChanges()){
				if(iRepuestosPendientes === 0){
					// No existe nada para notificar
					MessageToast.show(this.getResourceBundle().getText('noExisteNadaNotifiacar'),{
						width: '30em'
					});

				}else{
					this._notificarMateriales(this.sOrden);
					
				}
				return;
			}
			
			this._oBusyDialogNotificacion.open();

			oProcesoNotificacionModel.setProperty("/busy", true);
			oProcesoNotificacionModel.setProperty("/isCompleted", false);
			oProcesoNotificacionModel.setProperty("/mostrarOrden", true);
			
			oViewModel.setProperty("/busyNotificaciones", true);
						
			oModel.submitChanges({
				success: function(oData, oResponse){
					
					oViewModel.setProperty("/busyNotificaciones", false);
					
					oModel.resetChanges();
					
					var oDataResponse = oData.__batchResponses[0].__changeResponses;
					
					// Si tenemos una respuesta de notificación de tiempos con ErrorMsg
					var bExisteSinErrores = false;
					var sMessageError = "";
					for (var i = 0; i < oDataResponse.length; i++) {
						if(oDataResponse[i].data.ErrorMsg === ""){
							bExisteSinErrores = true;
						}
						sMessageError += oDataResponse[i].data.ErrorMsg;
					}					
					
					if(sMessageError === ""){
						
						// Actualizamos el histórico de notificaciones
						this._getNotificaciones();
						
						
						oProcesoNotificacionModel.setProperty("/busy", false);
						oProcesoNotificacionModel.setProperty("/info",""); 
						oProcesoNotificacionModel.setProperty("/description", "Notificación de tiempos creada correctamente");
						oProcesoNotificacionModel.setProperty("/icon","accept"); 
						oProcesoNotificacionModel.setProperty("/state", "Low");
						oProcesoNotificacionModel.setProperty("/errorOrden", false);
						this._notificarMateriales(this.sOrden);
					}else{
						oProcesoNotificacionModel.setProperty("/busy", false);
						oProcesoNotificacionModel.setProperty("/info",""); 
						var sMessage = Utils.parseError(oResponse.body);
						oProcesoNotificacionModel.setProperty("/description", sMessageError);
						oProcesoNotificacionModel.setProperty("/icon","decline"); 
						oProcesoNotificacionModel.setProperty("/state", bExisteSinErrores ? "Medium" : "High");
						oProcesoNotificacionModel.setProperty("/errorOrden", true);
						oProcesoNotificacionModel.setProperty("/mostrarRepuestos", false);	
					}
										
				}.bind(this)
			})
			
		},
		
		onCerrarOrden : function(){
				
			var oModel = this.getModel();
			var oViewModel = this.getModel('viewModel');
			var oOperacionesModel = this.getModel('operacionesModel');
			
			var oOperaciones = oOperacionesModel.getProperty("/");
			var bExisteOperacionPendiente = false;
			for (var i = 0; i < oOperaciones.length && !bExisteOperacionPendiente; i++) {
				if(!oOperaciones[i].Completada) bExisteOperacionPendiente = true;
			}
			
			if(!bExisteOperacionPendiente){
				
				MessageBox.show(
					"No existen tareas pendientes de notificar. ¿Desea finalizar la orden?", {
						icon: MessageBox.Icon.INFORMATION,
						title: "Información",
						actions: [MessageBox.Action.YES, MessageBox.Action.NO],
						onClose: function(oAction) {
							if(oAction === "YES"){
								oViewModel.setProperty("/cargandoOrden", true);

								oModel.callFunction("/CerrarOrden", {
									method: 'POST',
									urlParameters: {
										Orden : this.sOrden
									},
									success: function(oData){
										oViewModel.setProperty("/cargandoOrden", false);
										this.onNavBack();															
									}.bind(this),
									error: function(oError){
										oViewModel.setProperty("/cargandoOrden", false)
										var sMessage = Utils.parseError(oError.responseText);
										MessageBox.error(sMessage);
									}.bind(this)
								});
							}
						}.bind(this)
					}
				);
			}
			
			
			
		},
		
		onPressFinalizarOrden : function(oEvent){
			var oModel = this.getModel();
			var oViewModel = this.getModel('viewModel');
			
			MessageBox.show(
					"¿Desea finalizar la orden?", {
						icon: MessageBox.Icon.WARNING,
						title: "Información",
						actions: [MessageBox.Action.YES, MessageBox.Action.NO],
						onClose: function(oAction) {
							if(oAction === "YES"){
								oViewModel.setProperty("/cargandoOrden", true);

								oModel.callFunction("/CerrarOrden", {
									method: 'POST',
									urlParameters: {
										Orden : this.sOrden
									},
									success: function(oData){
										oViewModel.setProperty("/cargandoOrden", false);
										this.onNavBack();															
									}.bind(this),
									error: function(oError){
										oViewModel.setProperty("/cargandoOrden", false)
										var sMessage = Utils.parseError(oError.responseText);
										MessageBox.error(sMessage);
									}.bind(this)
								});
							}
						}.bind(this)
					}
				);
		},
		
		onPressEditarTarea : function(oEvent){
			var oViewModel = this.getModel('viewModel');
			var oBindingContext = oEvent.getSource().getBindingContext('operacionesModel');
			this._openDialogTarea(oBindingContext);
		},
		
		onAceptarEditarTarea : function(oEvent){
			
			var oViewModel = this.getModel('viewModel');
			var oOperacionesModel = this.getModel('operacionesModel');

			var oBindingContext = this._oDialogoTarea.getBindingContext('operacionesModel');
			
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/FechaInicio",   oViewModel.getProperty("/FechaInicio"));
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/FechaFin", 		oViewModel.getProperty("/FechaFin"));
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/HoraInicio", 	oViewModel.getProperty("/HoraInicio"));
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/HoraFin", 		oViewModel.getProperty("/HoraFin"));
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/Completada", 	oViewModel.getProperty("/Completada"));
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/Motivo", 		oViewModel.getProperty("/Motivo"));
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/Observacion", 	oViewModel.getProperty("/Observacion"));
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/Error", 		false);
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/ErrorMessage", 	'');
			oOperacionesModel.setProperty(oBindingContext.getPath() + "/Notificada", 	false);
		
			this._oDialogoTarea.close();
		},
		
		onCancelarEditarTarea : function(oEvent){
			var oViewModel = this.getModel('viewModel');
			var oBindingContext = oEvent.getSource().getBindingContext('operacionesModel');

			oViewModel.setProperty("/FechaInicio", 	oBindingContext.getProperty("FechaInicio") 	|| new Date());
			oViewModel.setProperty("/FechaFin", 	oBindingContext.getProperty("FechaFin") 	|| new Date());
			oViewModel.setProperty("/HoraInicio", 	oBindingContext.getProperty("HoraInicio"));
			oViewModel.setProperty("/HoraFin", 		oBindingContext.getProperty("HoraFin"));
			oViewModel.setProperty("/Completada", 	oBindingContext.getProperty("Completada"));
			oViewModel.setProperty("/Observacion", 	oBindingContext.getProperty("Observacion"));
			oViewModel.setProperty("/Motivo", 		oBindingContext.getProperty("Motivo"));
			this._oDialogoTarea.close();
		},			
		
		onNuevoRepuesto : function(oEvent) {	
			this._resetRepuestoSeleccionado();
			this._oDialogoCrearRepuesto.open();
		},
		
		onUpdateFinishedRepuesto : function(oEvent) {
			var iLength = oEvent.getParameter('actual');
			var oViewModel = this.getModel('viewModel');
			oViewModel.setProperty("/numRepuestos", iLength);
		},

		onConfirmRepuesto: function(oEvent){
			var oModel = this.getModel('repuestosModel');
			var oSelectedItem = oEvent.getParameter('selectedItem');
			var oSelectedItemContext = oSelectedItem.getBindingContext('repuestosMatchCodeModel');
			
			oModel.setProperty("/selectedItem/Matnr", oSelectedItemContext.getProperty("Matnr"));
			oModel.setProperty("/selectedItem/Maktx", oSelectedItemContext.getProperty("Maktx"));
			oModel.setProperty("/selectedItem/Meins", oSelectedItemContext.getProperty("Meins"));
			oModel.setProperty("/selectedItem/Lgort", oSelectedItemContext.getProperty("Lgort"));
			oModel.setProperty("/selectedItem/Werks", oSelectedItemContext.getProperty("Werks"));
		
		},

		onValueHelpRepuesto : function(oEvent) {
			if(!this._oMatchCodeRepuestos){
				this._oMatchCodeRepuestos = sap.ui.xmlfragment("es.cdl.yesui5pm002.view.fragment.MatchCodeRepuestos", this);
				this.getView().addDependent(this._oMatchCodeRepuestos);
			}

			var oViewModel = this.getModel('viewModel');
			oViewModel.setProperty("/selectedKeyRepuestos", "repEquipo");
			
			var oBindingContext = this.getView().getBindingContext();
			
			this._getRepuestos(oBindingContext.getProperty("Equnr"));	
						
			this._oMatchCodeRepuestos.open();

		},
		
		onSelectionChangeRepuestos : function(oEvent){
			var sKey = oEvent.getParameter('item').getKey();
			
			if(sKey === "repEquipo"){
				var oBindingContext = this.getView().getBindingContext();
				this._getRepuestos(oBindingContext.getProperty("Equnr"));	
			}else{
				this._getRepuestos();
			}
		},
		
		onSelectRepuesto : function(oEvent){
			var oRepuestosModel = this.getModel('repuestosModel');
			var oSelectedItem = oEvent.getParameter('listItem').getBindingContext('repuestosMatchCodeModel').getObject();
			oRepuestosModel.setProperty("/selectedItem", oSelectedItem);
			
			oEvent.getSource().removeSelections();
			this._oMatchCodeRepuestos.close();
		},
		
		onPressCancelarMathCodeRepuestos : function(oEvent){
			var oList = sap.ui.getCore().byId('listRepuestos');
			oList.removeSelections();
			this._oMatchCodeRepuestos.close();
		},

		onAceptarCrearRepuesto : function(oEvent) {
			
			var oModel = this.getModel('repuestosModel');

			var sMatnr  = oModel.getProperty("/selectedItem/Matnr");
			var sMatnrState = oModel.getProperty("/selectedItem/MatnrState");

			
			if(!sMatnr || sMatnr === "" || sMatnrState === "Error"){
				MessageToast.show(this.getResourceBundle().getText('introduzcaRepuesto'));
				return;
			}			
			
			var sMaktx    = oModel.getProperty("/selectedItem/Maktx");
			var sCantidad = oModel.getProperty("/selectedItem/Cantidad");
			var sUnidad   = oModel.getProperty("/selectedItem/Meins");
			var sLgort    = oModel.getProperty("/selectedItem/Lgort");
			var sWerks    = oModel.getProperty("/selectedItem/Werks");
			
			/* Creamos la línea del material seleccionado */

			var aRepuestos = oModel.getProperty("/repuestos");
			 
			for(var x = 0, len = aRepuestos.length, bExiste = false; x < len  && !bExiste ; x++){
				if(aRepuestos[x].Matnr === sMatnr){
					bExiste = true;
					aRepuestos[x].Cantidad = sCantidad;
				}
			}
			
			if(!bExiste){
				aRepuestos.push({
					Matnr: sMatnr,
					Maktx: sMaktx,
					Cantidad: sCantidad,
					Meins: sUnidad,
					Lgort: sLgort,
					Werks: sWerks
				});
			}
			
			
			oModel.setProperty("/repuestos", aRepuestos);
						
			/* Eliminamos el material seleccionado del modelo */
			this._resetRepuestoSeleccionado();
			
			this._oDialogoCrearRepuesto.close();
			
		},
		
		_resetRepuestoSeleccionado : function() {
			
			var oRepuestosModel = this.getModel('repuestosModel');

			oRepuestosModel.setProperty("/selectedItem/Matnr", "");
			oRepuestosModel.setProperty("/selectedItem/Maktx", "");
			oRepuestosModel.setProperty("/selectedItem/Cantidad", "");
			oRepuestosModel.setProperty("/selectedItem/Lgort", "");
			oRepuestosModel.setProperty("/selectedItem/Werks", "");
			oRepuestosModel.setProperty("/selectedItem/Meins", "");			
			oRepuestosModel.setProperty("/selectedItem/MatnrState", "None");

		},
		
		onCancelarCrearRepuesto : function(oEvent){			
			/* Eliminamos el material seleccionado del modelo */
			this._resetRepuestoSeleccionado();
			this._oDialogoCrearRepuesto.close();
		},
		
		onEliminarRepuesto : function(oEvent) {
			var oModel = this.getModel('repuestosModel');
			var oSelectedItemContext = oEvent.getParameter('listItem').getBindingContext('repuestosModel');
			var sMatnr = oSelectedItemContext.getProperty("Matnr");

			var aRepuestos = oModel.getProperty("/repuestos");
			
			for(var x = 0, len = aRepuestos.length, bExiste = false; x < len  && !bExiste ; x++){
				if(aRepuestos[x].Matnr === sMatnr){
					bExiste = true;
					aRepuestos.splice(x,1);
				}
			}
			
			oModel.setProperty("/repuestos", aRepuestos);

		},
		
		onAfterCloseDialogoOrden : function(oEvent){
//			this._onCloseDialogoCambiarOrden();
		},
		
		onCerrarDialogoProcesoNotificacion : function(oEvent){
		 	var oProcesoNotificacionModel = this.getView().getModel('procesoNotificacionModel');
			this._oBusyDialogNotificacion.close();
			
			if(!oProcesoNotificacionModel.getProperty("/errorOrden")){
				this.onCerrarOrden();
			}
			
			this._resetProcesoNotificacion();
			
		},
		
		onHandleTrabajo : function(oEvent){
			
			var oButton = oEvent.getSource();
			
			var oModel = this.getModel();
			var oViewModel = this.getModel('viewModel');
			var oOperacionesModel = this.getModel('operacionesModel');
			
			var oBindingContext = oButton.getBindingContext('operacionesModel');
			
			var oOperacion = oBindingContext.getObject();
			var oOperacionPath = oBindingContext.getPath();
			
			var oTime = new Time();
			
			var oOrden = this.getView().getBindingContext().getObject();
			
			var oFecha = oOperacion.FechaInicio || new Date(); 
			var oTimeFormatter = new sap.ui.model.odata.type.DateTime({pattern : "PThh'H'mm'M'ss'S'"});
			
			var oHoraIni = oOperacion.HoraInicio || oTimeFormatter.formatValue(new Date(), 'string');
				
			oFecha = Utils.getUTCDate(new Date());			
			
			var fnSuccessCompletada  = undefined;

			/* Comprobamos si la tarea está iniciada */
			if(OperacionUtils.isTareaIniciada(oOperacion.FechaInicio, oOperacion.FechaFin, oOperacion.HoraInicio, oOperacion.HoraFin)){
				var oTimeFin = oTime.parseValue(new Date().toLocaleTimeString(), "string");
				var oFechaFin = Utils.getUTCDate(new Date());
				oOperacionesModel.setProperty(oBindingContext.getPath()+"/FechaFin", oFechaFin);
				oOperacionesModel.setProperty(oBindingContext.getPath()+"/HoraFin", oTimeFin);
				
				fnSuccessCompletada = (oBindingContext) => {
					this._openDialogTarea(oBindingContext);
				}
				oButton.setBusy(true);
				oModel.callFunction("/CerrarNotificacionTemporal", {
					method: 'POST',
					urlParameters: {
							Pernr: this.sPernr,
							 Aufnr: oOperacion.Orden,
							Vornr: oOperacion.Activity,
							FechaFin: oFechaFin,
							HoraFin: oTimeFin 
					},
					success: function(oData){
						oButton.setBusy(false);
						var oBindingContext = oButton.getBindingContext('operacionesModel');
						var sPath = oBindingContext.getPath();
						
						oOperacionesModel.setProperty(sPath + "/FechaInicio", oData.CrearNotificacionTemporal.FechaIni);
						oOperacionesModel.setProperty(sPath + "/HoraInicio", oData.CrearNotificacionTemporal.HoraIni);
						if(oData.CrearNotificacionTemporal.FechaFin) oOperacionesModel.setProperty(sPath + "/FechaFin", oData.CrearNotificacionTemporal.FechaFin);
						if(oData.CrearNotificacionTemporal.HoraFin && oData.CrearNotificacionTemporal.HoraFin.ms !== 0) oOperacionesModel.setProperty(sPath + "/HoraFin", oData.CrearNotificacionTemporal.HoraFin);
						
						if(fnSuccessCompletada) fnSuccessCompletada(oBindingContext);												
					}.bind(this),
					error: function(oError){
						var sMessage = Utils.parseError(oError.responseText)
						MessageBox.confirm(
							sMessage, {
							icon: sap.m.MessageBox.Icon.ERROR,
							actions: [sap.m.MessageBox.Action.OK],
							title: "Error",
							onClose: function(oAction) {}.bind(this)
						});
						oButton.setBusy(false);
					}.bind(this)
				});
			}else{
				oButton.setBusy(true);
				oModel.callFunction("/CrearNotificacionTemporal", {
					method: 'POST',
					urlParameters: {
							Pernr: this.sPernr,
							 Aufnr: oOperacion.Orden,
							Vornr: oOperacion.Activity,
						/*	FechaIni: oFecha,
							HoraIni: oHoraIni */
					},
					success: function(oData){
						oButton.setBusy(false);
						var oBindingContext = oButton.getBindingContext('operacionesModel');
						var sPath = oBindingContext.getPath();
						
						oOperacionesModel.setProperty(sPath + "/FechaInicio", oData.CrearNotificacionTemporal.FechaIni);
						oOperacionesModel.setProperty(sPath + "/HoraInicio", oData.CrearNotificacionTemporal.HoraIni);
						if(oData.CrearNotificacionTemporal.FechaFin) oOperacionesModel.setProperty(sPath + "/FechaFin", oData.CrearNotificacionTemporal.FechaFin);
						if(oData.CrearNotificacionTemporal.HoraFin && oData.CrearNotificacionTemporal.HoraFin.ms !== 0) oOperacionesModel.setProperty(sPath + "/HoraFin", oData.CrearNotificacionTemporal.HoraFin);
						
						if(fnSuccessCompletada) fnSuccessCompletada(oBindingContext);												
					}.bind(this),
					error: function(oError){
						var sMessage = Utils.parseError(oError.responseText)
						MessageBox.confirm(
							sMessage, {
							icon: sap.m.MessageBox.Icon.ERROR,
							actions: [sap.m.MessageBox.Action.OK],
							title: "Error",
							onClose: function(oAction) {}.bind(this)
						});
						oButton.setBusy(false);
					}.bind(this)
				});
			}
			
		},
		
		_notificarMateriales : function(sAufnr){

			var oModel 					  = this.getModel();
			var oViewModel 				  = this.getModel('viewModel');
		 	var oRepuestosModel  	  	  = this.getModel('repuestosModel');
		 	var oProcesoNotificacionModel = this.getModel('procesoNotificacionModel');
		 	
		 	var oRepuestos 			  = oRepuestosModel.getProperty("/repuestos");

		 	if(oRepuestos.length === 0){
				oProcesoNotificacionModel.setProperty("/isCompleted", true);
		 		return;
		 	}
		 	
		 	/* Creamos el Entry de los repuestos */
		 	for (var i = oRepuestos.length - 1; i >= 0; i--) {
		 		var oRepuesto = oRepuestos[i];
		 		oModel.createEntry("/NotificarRepuestosSet",{
					properties: {
						Aufnr: sAufnr,
						Werks: oRepuesto.Werks,
						Matnr: oRepuesto.Matnr,		// Material
						Lgfsb: oRepuesto.Lgort, 	// Almacen
						Erfme: oRepuesto.Meins, 	// Unidad 
						Lgpbe: "", 					// Ubicación 
						Menge: oRepuesto.Cantidad,  // Cantidad
					}
				});
		 	}		 	

		 	oProcesoNotificacionModel.setProperty("/iconMateriales","upload-to-cloud"); 
		 	oProcesoNotificacionModel.setProperty("/busyMateriales", true);
		 	
			this._oBusyDialogNotificacion.open();
		 			 	
		 	/* Enviamos los datos a SAP */
			oModel.submitChanges({
				success: function(oData){			
										
					oModel.resetChanges();
					oRepuestosModel.setProperty("/repuestos", []);
					
					var oResponse = oData.__batchResponses[0].response;

					if(oResponse && (oResponse.statusCode === "400" || oResponse.statusCode === "500")){
						
						oProcesoNotificacionModel.setProperty("/busyMateriales", false);
						oProcesoNotificacionModel.setProperty("/isCompletedMateriales", true); 
						oProcesoNotificacionModel.setProperty("/infoMateriales",""); 
						var sMessage = Utils.parseError(oResponse.body);
						oProcesoNotificacionModel.setProperty("/descriptionMateriales", sMessage);
						oProcesoNotificacionModel.setProperty("/iconMateriales","decline"); 
						oProcesoNotificacionModel.setProperty("/stateMateriales", "High");
						oProcesoNotificacionModel.setProperty("/errorOrden", true);
					}else{
						// var oDataResponse = oData.__batchResponses[0].__changeResponses[0].data;
						oProcesoNotificacionModel.setProperty("/busyMateriales", false);
						oProcesoNotificacionModel.setProperty("/isCompletedMateriales", true); 
						oProcesoNotificacionModel.setProperty("/infoMateriales",""); 
						oProcesoNotificacionModel.setProperty("/descriptionMateriales", "Repuestos consumidos correctamente");
						oProcesoNotificacionModel.setProperty("/iconMateriales","accept"); 
						oProcesoNotificacionModel.setProperty("/stateMateriales", "Low");
						oProcesoNotificacionModel.setProperty("/errorOrden", false);
						oProcesoNotificacionModel.setProperty("/isCompleted", true);		
						
						// Actualizamos el consumo de repuestos histórico
						this._getRepuestosHistorico();
						
					}
					
				}.bind(this),
				error: function(){
					MessageBox.confirm(
						"The error occurred on the application server, you will find more information in transaction ST22", {
				        icon: sap.m.MessageBox.Icon.ERROR,
				        actions: [sap.m.MessageBox.Action.OK],
				        title: "Error",
				        onClose: function(oAction) {
							if(fnError) fnError();
				        }.bind(this)
					});
				}.bind(this)
			});
		 },
		
		_resetModels : function(){
			
			var oViewModel = this.getModel('viewModel');
			var oRepuestosModel = this.getModel('repuestosModel');
			var oNotificacionesModel = this.getModel('notificacionesModel');
			var oRepuestosHistoricoModel = this.getModel('repuestosHistoricoModel');
			var oProcesoNotificacionModel = this.getModel('procesoNotificacionModel');
			
			oViewModel.setProperty("/", {
				Observacion: '',
				FechaInicio: new Date(),
				FechaFin: new Date(),
				HoraInicio: undefined,
				HoraFin: undefined, 
				Completada: false,
				ordenCargada: false,
				cargandoOrden: false
			});			
			
			oProcesoNotificacionModel.setProperty("/", {
				busy: false,
				info: "Creando notificación...",
				icon: "upload-to-cloud",
				iconMateriales: "lateness",
				infoMateriales: "Pendiente notificación de repuestos.",
				isCompleted: false,
				mostrarRepuestos: false,
				mostrarOrden: false,
				errorOrden: false
			});
			
			oRepuestosModel.setProperty("/", {
				repuestos: new Array(),
				selectedItem: {}
			});
			
			oNotificacionesModel.setProperty("/", []);
						
			oRepuestosHistoricoModel.setProperty("/", []);
		},
		
		_setOrden : function(sOrden){

			var oViewModel = this.getModel('viewModel');
			
			oViewModel.setProperty("/ordenCargada", true);

			this.sOrden = sOrden;

			this._bindOrden(								
					/* Success */
					() => {
						this._getNotificacionTemporal();
						this._getNotificaciones();
						this._getRepuestosHistorico();
						this._getMotivos();
					},
					
					/* Error */
					() => {}
				);
			
		},
		
		
		_getOperaciones : function() {
			var oModel = this.getModel();
			var oViewModel = this.getModel('viewModel');
			var oOperacionesModel = this.getModel('operacionesModel');
			var oNotificacionTemporalModel = this.getModel('notificacionTemporalModel');
			
			oOperacionesModel.setProperty("/", []);
			
			oViewModel.setProperty("/cargandoOperaciones", true);
			
			oModel.read("/OperacionesSet", {
				filters: [new Filter({
					path: 'Orden',
					operator: 'EQ',
					value1: this.sOrden
				})],
				success : function(oData, oResponse){
					
					oViewModel.setProperty("/cargandoOperaciones", false);
					
					var oOperaciones = oData.results;
					var oNotifTemporalPosiciones = oNotificacionTemporalModel.getData() || [];
					/* Contamos solo las tareas no completadas */
					var iNumTareas = 0;	

					for (var i = 0; i < oOperaciones.length; i++) {
						if(!oOperaciones[i].Completada) iNumTareas += 1;
						
						var bExiste = false;
						
						/* Añadimos si existe tarea pendiente de notificar */
						for (var x = 0; x < oNotifTemporalPosiciones.length && !bExiste; x++) {
							if(oNotifTemporalPosiciones[x].Aufnr === oOperaciones[i].Orden &&
									oNotifTemporalPosiciones[x].Vornr === oOperaciones[i].Activity){
								
								oOperaciones[i].FechaInicio = oNotifTemporalPosiciones[x].FechaIni;
								oOperaciones[i].FechaFin = oNotifTemporalPosiciones[x].FechaFin;
								oOperaciones[i].HoraInicio = oNotifTemporalPosiciones[x].HoraIni;
								
								if(oNotifTemporalPosiciones[x].HoraFin && oNotifTemporalPosiciones[x].HoraFin.ms === 0){
									oOperaciones[i].HoraFin = undefined;
								}else{
									oOperaciones[i].HoraFin = oNotifTemporalPosiciones[x].HoraFin;
								}
																
								bExiste = true;						
							}
						}
						
						if(!bExiste){
							oOperaciones[i].HoraInicio = undefined;
							oOperaciones[i].HoraFin = undefined;
						}
						
						oOperaciones[i].Error = false;
						oOperaciones[i].ErrorMessage = '';
					}
					
					oViewModel.setProperty("/numTareas", iNumTareas);
					oOperacionesModel.setProperty("/", oOperaciones);
					
					if(iNumTareas === 0){
						this.onCerrarOrden();
					}
					
				}.bind(this)
			})
		},
		
		onChangeRepuesto : function(oEvent){
			var sValue = oEvent.getParameter('value');
			var oRepuestosModel = this.getModel('repuestosModel');
			var bExisteMatnr = false;
			var oRepuesto = undefined;
			
			oRepuestosModel.setProperty("/selectedItem/MatnrState", "None");
			
			this._getRepuestos(undefined, () => {
				
				var oRepuestosMatchCodeModel = this.getModel('repuestosMatchCodeModel');
				var oRepuestos = oRepuestosMatchCodeModel.getProperty("/");
				
				for (var i = 0; i < oRepuestos.length && !bExisteMatnr; i++) {
					if(oRepuestos[i].Matnr === sValue){
						bExisteMatnr = true;
						oRepuesto = oRepuestos[i];
						break;
					}
				}
				
				if(bExisteMatnr){
					oRepuestosModel.setProperty("/selectedItem", oRepuesto);
					oRepuestosModel.setProperty("/selectedItem/MatnrState", "None");
				}else{
					oRepuestosModel.setProperty("/selectedItem", { Matnr: sValue });
					oRepuestosModel.setProperty("/selectedItem/MatnrState", "Error");
				}
				
			});
			
		},
		
		_getRepuestos : function(sEqunr, fnSuccess){
			
			var oModel = this.getModel();
			var oRepuestosMatchCodeModel = this.getModel('repuestosMatchCodeModel');
			var oViewModel = this.getModel('viewModel');
			
			oRepuestosMatchCodeModel.setProperty("/", []);
			var aFilters = [];
			
			var sWerks = this.getView().getBindingContext().getProperty("Werks");

			aFilters.push(new Filter({
				path: 'Werks',
				operator: 'EQ',
				value1: sWerks
			}));

			if(sEqunr){
				aFilters.push(new Filter({
					path: 'Equnr',
					operator: 'EQ',
					value1: sEqunr
				}));
			}
			
			oViewModel.setProperty("/cargandoRepuestos", true);
			
			oModel.read("/RepuestosSet",{
				filters: aFilters,
				success: function(oData){
					oRepuestosMatchCodeModel.setProperty("/", oData.results);
					oViewModel.setProperty("/cargandoRepuestos", false);
					if(fnSuccess) fnSuccess();
				}
			});
		},
		
		_getNotificaciones : function(){
			
			var oModel = this.getModel();
			var oNotificacionesModel = this.getModel('notificacionesModel');
			
			oNotificacionesModel.setProperty("/", []);
			
			oModel.read("/NotificacionesSet",{
				filters: [new Filter({
					path: 'Orderid',
					operator: 'EQ',
					value1: this.sOrden
				})],
				success: function(oData){
					oNotificacionesModel.setProperty("/", oData.results);
				}
			});
		},
		
		_getMotivos : function(){
			
			var oModel = this.getModel();
			var oMotivosModel = this.getModel('motivosModel');
			
			var sWerks = this.getView().getBindingContext().getProperty("Werks");
			
			oMotivosModel.setProperty("/", []);
			
			oModel.read("/MotivosSet",{
				filters: [new Filter({
					path: 'Werks',
					operator: 'EQ',
					value1: sWerks
				})],
				success: function(oData){
					oMotivosModel.setProperty("/", oData.results);
				}
			});
		},
		
		_getRepuestosHistorico : function(){
			
			var oModel = this.getModel();
			var oRepuestosHistoricoModel = this.getModel('repuestosHistoricoModel');
			
			oRepuestosHistoricoModel.setProperty("/", []);
			
			oModel.read("/RepuestosHistoricoSet",{
				filters: [new Filter({
					path: 'Aufnr',
					operator: 'EQ',
					value1: this.sOrden
				})],
				success: function(oData){
					oRepuestosHistoricoModel.setProperty("/", oData.results);
				}
			});
		},
		
		_getOperacionPathById : function(sOperacionId) {
			var oOperacionesModel = this.getModel('operacionesModel');
			var oOperaciones = oOperacionesModel.getProperty("/");
			for (var i = 0; i < oOperaciones.length; i++) {
				var oOperacion = oOperacionesModel.getProperty("/" + i);
				if(oOperacion.Activity === sOperacionId)
					return "/" + i;
			}			
		},
		
		_resetProcesoNotificacion: function(){
			var oProcesoNotificacionModel = this.getModel('procesoNotificacionModel');
			
			oProcesoNotificacionModel.setData({
				busy: false,
				info: "Creando notificación...",
				icon: "upload-to-cloud",
				iconMateriales: "lateness",
				infoMateriales: "Pendiente notificación de repuestos.",
				isCompleted: false,
				mostrarRepuestos: false,
				mostrarOrden: false,
				errorOrden: false
			});

		 },
		 
		_onCloseDialogoCambiarOrden : function(){
        	var oViewModel = this.getModel('viewModel');
        	var bOrdenCargada = oViewModel.getProperty("/ordenCargada");
        	this._oDialogoOrden.close();
        	if(!bOrdenCargada){
        		jQuery.sap.delayedCall(100, undefined, function(){
        			this.onNavBack();
        		}.bind(this));        		
        	}
        },
		
		_getNotificacionTemporal : function(){
			this.getModel('viewModel').setProperty("/cargandoOperaciones", true);
			this.getModel().read("/NotificacionTemporalSet", {
				filters: [new Filter({
					path: 'Aufnr',
					operator: 'EQ',
					value1: this.sOrden
				}),
				new Filter({
					path: 'Pernr',
					operator: 'EQ',
					value1: this.sPernr
				})],
			    success: function(oData, oResponse){
					this.getView().getModel("notificacionTemporalModel").setData(oData.results);
					this._getOperaciones();
				}.bind(this),
			    error: function(oData, oResponse){
					MessageBox.error("Ocurrió un error al recuperar el trabajo en proceso.");
				}.bind(this),
			})
		},
				
	   _bindOrden : function(fnSuccess, fnError){
    	   
    	   var oView = this.getView();
    	   var oModel = this.getModel();
    	   var oViewModel = this.getModel('viewModel');
           
           var oResourceBundle = this.getModel("i18n").getResourceBundle();
           
           oViewModel.setProperty("/ordenCargada", false);
           
           var sOrden = this.sOrden || oViewModel.getProperty("/orden");
           var oOrden = oModel.getObject("/OrdenesSet('" + sOrden + "')");
           
           oViewModel.setProperty("/cargandoOrden", true);            
           
           oView.bindElement({
                path: "/OrdenesSet('" + sOrden + "')",
                events: {
                     dataReceived: function(oEvent){
                   	    // Comprobamos si la orden es correcta
                        if(oEvent.getParameter("data") != undefined){
                       	   oViewModel.setProperty("/ordenCargada", true);
                           oViewModel.setProperty("/cargandoOrden", false);            

                       	   fnSuccess();
                        }else{
                           oViewModel.setProperty("/ordenCargada", false);
                           oViewModel.setProperty("/cargandoOrden", false);
                           fnError();
                        } 
                         
                     }.bind(this)
                }
           });                 
           
           /* Si existe la orden no se lanza el dataReceived por lo que obtenemos las operaciones */
           if(oOrden){
           	   oViewModel.setProperty("/ordenCargada", true);
               oViewModel.setProperty("/cargandoOrden", false);
           	   fnSuccess();
           }
           
        },       
		
		_openDialogTarea : function(oBindingContext){
			var oViewModel = this.getModel('viewModel');

			oViewModel.setProperty("/FechaInicio", 		oBindingContext.getProperty("FechaInicio") 	|| new Date());
			oViewModel.setProperty("/FechaFin", 		oBindingContext.getProperty("FechaFin") 	|| new Date());
			oViewModel.setProperty("/HoraInicio", 		oBindingContext.getProperty("HoraInicio"));
			oViewModel.setProperty("/HoraFin", 			oBindingContext.getProperty("HoraFin"));
			oViewModel.setProperty("/Completada", 		oBindingContext.getProperty("Completada"));
			oViewModel.setProperty("/Observacion", 		oBindingContext.getProperty("Observacion"));

			this._oDialogoTarea.bindElement('operacionesModel>' + oBindingContext.getPath());
			this._oDialogoTarea.open();
		},
        
	});
	
});