module.exports=function createDOM(){
const camel=s=>s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class Node{
 constructor(tag='div',attrs=''){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.events={};this.hidden=false;this.disabled=false;for(const a of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g))this.setAttribute(a[1],a[2]||'');}
 setAttribute(k,v){this.attrs[k]=v;if(k==='id')this.id=v;if(k.startsWith('data-'))this.dataset[camel(k.slice(5))]=v;}
 append(n){n.remove();n.parentNode=this;this.children.push(n);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}
 get isConnected(){for(let n=this;n;n=n.parentNode)if(n===document.body)return true;return false;}
 set innerHTML(v){this.html=v;this.children=[];const stack=[this];for(const t of v.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/g)){if(t[1]){if(stack.length>1)stack.pop();}else{const n=new Node(t[2],t[3]);stack.at(-1).append(n);if(!['img','input','br','hr'].includes(t[2]))stack.push(n);}}}get innerHTML(){return this.html||'';}
 matches(s){if(s===':popover-open')return !!this.popoverOpen;if(s==='dialog[open]')return this.tagName==='dialog'&&this.open;if(s.startsWith('#'))return this.id===s.slice(1);if(s.startsWith('.'))return (this.attrs.class||'').split(' ').includes(s.slice(1));const m=s.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);return m?camel(m[1]) in this.dataset&&(m[2]===undefined||this.dataset[camel(m[1])]===m[2]):s===this.tagName;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}closest(s){for(let n=this;n;n=n.parentNode)if(n.matches(s))return n;return null;}
 contains(n){for(;n;n=n.parentNode)if(n===this)return true;return false;}addEventListener(k,fn){(this.events[k]||=[]).push(fn);}removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(f=>f!==fn);}emit(k,e={}){for(const fn of this.events[k]||[])fn(e);}focus(){document.activeElement=this;}showPopover(){this.popoverOpen=true;}hidePopover(){this.popoverOpen=false;}showModal(){this.open=true;}close(){this.open=false;}
}
const document=new Node();document.body=new Node('body');document.append(document.body);document.createElement=t=>new Node(t);document.hidden=false;
return {Node,document};
};
