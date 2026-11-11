window.configureMetaPixel=function(id){
 if(!/^\d+$/.test(id))return;
 const fbq=function(){if(fbq.callMethod)fbq.callMethod.apply(fbq,arguments);else fbq.queue.push(arguments);};
 fbq.queue=[];fbq.loaded=true;fbq.version='2.0';window.fbq=fbq;window._fbq=fbq;
 fbq('init',id);const script=document.createElement('script');script.src='https://connect.facebook.net/en_US/fbevents.js';script.async=true;document.head.append(script);
};
