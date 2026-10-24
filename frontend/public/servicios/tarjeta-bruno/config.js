// Public configuration only. Do not put secrets here.
window.BRUNO_FORM_CONFIG={
 endpoint:'/api/bruno-service/requests',
 localeEndpoint:'/api/bruno-service/locale',
 authUrl:null // Use the verified BRUNO sign-in URL if required, never a ChatGPT login.
};
window.BRUNO_PAYMENTS={
 CO:{url:'',bankDetails:''}, // Owner-approved Colombian payment destination.
 US:{url:'',bankDetails:''}  // Owner-approved US payment destination.
};
