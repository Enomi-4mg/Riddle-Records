'use strict';
document.getElementById('choice').textContent = new Date();
if(window.confirm('応答してください。')){
    console.log('ようこそ。');
}else{
    console.log('そうですか。');
}