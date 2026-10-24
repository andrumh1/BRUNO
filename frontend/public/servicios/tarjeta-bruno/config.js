// Public configuration only. Do not put secrets here.
window.BRUNO_FORM_CONFIG={
 endpoint:'/api/bruno-service/requests',
 localeEndpoint:'/api/bruno-service/locale',
 authUrl:null // Use the verified BRUNO sign-in URL if required, never a ChatGPT login.
};
// Payment destinations are decided server-side per validated country after the request is saved
// (Colombia → Wompi · COP $30.000 | United States → Stripe · US$30). The text below is only informative.
window.BRUNO_PAYMENTS={
 CO:{url:'',bankDetails:'Pago seguro con Wompi (PSE, Nequi o tarjeta) al enviar tu solicitud. El pago se confirma solo con la verificación del proveedor. · Secure Wompi payment (PSE, Nequi or card) after submitting your request. Payment is confirmed only through the provider\'s verification.'},
 US:{url:'',bankDetails:'Pago seguro con Stripe al enviar tu solicitud. El pago se confirma solo con la verificación del proveedor. · Secure Stripe payment after submitting your request. Payment is confirmed only through the provider\'s verification.'}
};
