(function(){
'use strict';
var interest=document.getElementById('campaign_interest'),links=document.querySelectorAll('[data-interest]');
if(!interest||!links.length)return;
[].forEach.call(links,function(link){link.addEventListener('click',function(){interest.value=link.getAttribute('data-interest')||'Pricing page inquiry'})});
})();
