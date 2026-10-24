const formConfig=window.BRUNO_FORM_CONFIG||{};
const form=document.getElementById('requestForm'),statusEl=document.getElementById('formStatus'),submit=document.getElementById('submitRequest');
const t=(es,en)=>window.BRUNO_LOCALE?.lang==='en'?en:es;
let requestId=crypto.randomUUID(),previewUrls=[],statusMessage=null;
const show=(es,en)=>{statusMessage=[es,en];statusEl.textContent=t(es,en)};
window.addEventListener('bruno:locale',()=>{if(statusMessage)statusEl.textContent=t(...statusMessage)});
const maxCounts={documents:2,logo:1,gallery:8};
function validateFiles(){let total=0;for(const name of Object.keys(maxCounts)){const files=[...form.elements[name].files];if(files.length>maxCounts[name])return ['Hay demasiados archivos. Máximo: 2 documentos, 1 logo y 8 imágenes.','Too many files. Maximum: 2 documents, 1 logo and 8 gallery images.'];for(const file of files){total+=file.size;if(file.size>5*1024*1024)return ['Máximo 5 MB por archivo.','Maximum 5 MB per file.'];}}if(total>20*1024*1024)return ['Los archivos superan el máximo total de 20 MB.','Files exceed the 20 MB total limit.'];return null;}
form.querySelectorAll('input[type=file]').forEach(input=>input.addEventListener('change',()=>{input.parentElement.querySelector('.file-list').textContent=[...input.files].map(f=>`${f.name} (${(f.size/1024/1024).toFixed(1)} MB)`).join(' · ');const error=validateFiles();show(...(error||['','']));if(input.name==='gallery'){previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];const target=document.getElementById('galleryPreview');target.replaceChildren();[...input.files].slice(0,8).filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)).forEach(f=>{const img=document.createElement('img');img.src=URL.createObjectURL(f);previewUrls.push(img.src);img.alt=f.name;target.appendChild(img);});}}));
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;const error=validateFiles();if(error){show(...error);return;}
 submit.disabled=true;show('Enviando tu solicitud y los archivos…','Submitting your request and files…');document.getElementById('signInLink').hidden=true;
 const data=new FormData(form);data.set('requestId',requestId);data.set('market',window.BRUNO_LOCALE?.market||'US');data.set('language',window.BRUNO_LOCALE?.lang||'es');
 try{
  const response=await fetch(formConfig.endpoint||'/api/solicitudes',{method:'POST',body:data});const result=await response.json();
  if(response.status===401){const signIn=document.getElementById('signInLink');if(formConfig.authUrl!==null){if(formConfig.authUrl)signIn.href=formConfig.authUrl;signIn.hidden=false;}show('Inicia sesión antes de enviar. Guarda tus textos antes de salir; los archivos deberán seleccionarse de nuevo.','Sign in before submitting. Save your text before leaving; files will need to be selected again.');return;}
  if(!response.ok){show(result.error||'No se pudo enviar. Revisa los campos e inténtalo de nuevo.',result.errorEn||'Unable to submit. Check required fields, file formats and size limits, then try again.');return;}
  const ref=result.id;
  if(result.emailStatus==='accepted')show(`Solicitud recibida: ${ref}. El servicio de correo aceptó el envío a bruno@brunocard.com. No se ha realizado ningún cobro.`,`Request received: ${ref}. The email service accepted the message to bruno@brunocard.com. You have not been charged.`);
  else show(`Solicitud guardada: ${ref}. El envío por correo está pendiente; aún no podemos confirmar su llegada a bruno@brunocard.com. Puedes escribirnos indicando tu referencia. No se ha realizado ningún cobro.`,`Request saved: ${ref}. Email sending is pending; arrival at bruno@brunocard.com is not confirmed. You can email us with your reference. You have not been charged.`);
  form.reset();document.querySelectorAll('.file-list').forEach(e=>e.textContent='');document.getElementById('galleryPreview').replaceChildren();previewUrls.forEach(URL.revokeObjectURL);requestId=crypto.randomUUID();
 }catch{show('No se pudo completar el envío. Conserva tus materiales e inténtalo de nuevo.','Unable to complete your request. Keep your materials and try again.');}finally{submit.disabled=false;}
});
