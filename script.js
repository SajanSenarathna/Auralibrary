/* AuraLibrary v2 - all data is kept in localStorage via save().
   To move to Firebase later, only load/save need to change. */
const $=s=>document.querySelector(s),FINE=10;let ME='';
const td=()=>new Date().toISOString().slice(0,10);
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const df=(a,b)=>Math.round((new Date(a)-new Date(b))/864e5);
const uid=p=>p+Math.random().toString(36).slice(2,6);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mk=(id,t,a,p,c,i,n)=>({id,title:t,author:a,publisher:p,category:c,isbn:i,copies:n});
const seed=()=>({
 authors:['Stuart Russell','Robert C. Martin','Carl Sagan','Don Norman'],
 publishers:['Pearson','Prentice Hall','Random House','Basic Books'],
 categories:['Computer Science','Physics','Design','Mathematics'],
 books:[mk('b1','Artificial Intelligence: A Modern Approach','Stuart Russell','Pearson','Computer Science','978-0-13-604259-4',5),
  mk('b2','Clean Code','Robert C. Martin','Prentice Hall','Computer Science','978-0-13-235088-4',3),
  mk('b3','Cosmos','Carl Sagan','Random House','Physics','978-0-345-53943-4',2),
  mk('b4','The Design of Everyday Things','Don Norman','Basic Books','Design','978-0-465-05065-9',4)],
 members:[{id:'M1',name:'Samantha Perera',email:'sam@mail.lk',type:'Student'},{id:'M2',name:'Anura Bandara',email:'anura@mail.lk',type:'Staff'},{id:'M3',name:'Kasun Perera',email:'kasun@mail.lk',type:'Student'}],
 loans:[{id:'L1',bookId:'b1',memberId:'M2',issued:add(td(),-20),due:add(td(),-6),renewals:0},
  {id:'L2',bookId:'b2',memberId:'M1',issued:add(td(),-5),due:add(td(),9),renewals:0},
  {id:'L3',bookId:'b3',memberId:'M3',issued:add(td(),-12),due:add(td(),2),renewals:1}],
 res:[{id:'R1',bookId:'b1',memberId:'M1',date:td()}],fines:[]
});
/* ---- Supabase database ---- */
const SB=supabase.createClient('https://rzvucqchkfolynccbvtb.supabase.co','sb_publishable_a8kB8-KedF26Ji0QjYR1fg_xpxOMxxa');
let D=seed(),role='',who='',tab='dash',q='',cf='';
const nn=v=>v||null;
/* [key in D, table name, to database row, from database row] */
const TB=[
 ['books','books',b=>b,r=>r],
 ['members','members',m=>m,r=>r],
 ['loans','loans',l=>({id:l.id,book_id:l.bookId,member_id:l.memberId,issued:l.issued,due:l.due,returned:nn(l.returned),lost:nn(l.lost),renewals:l.renewals}),r=>({id:r.id,bookId:r.book_id,memberId:r.member_id,issued:r.issued,due:r.due,returned:r.returned,lost:r.lost,renewals:r.renewals})],
 ['res','reservations',x=>({id:x.id,book_id:x.bookId,member_id:x.memberId,date:x.date}),r=>({id:r.id,bookId:r.book_id,memberId:r.member_id,date:r.date})],
 ['fines','fines',f=>({id:f.id,member_id:f.memberId,why:f.why,amt:f.amt,paid:f.paid,date:f.date,paid_on:nn(f.paidOn)}),r=>({id:r.id,memberId:r.member_id,why:r.why,amt:r.amt,paid:r.paid,date:r.date,paidOn:r.paid_on})]
];
const LK=['authors','publishers','categories'],known={};
async function push(){
 for(const [k,t,to] of TB){
  const rows=D[k].map(to),ids=rows.map(r=>r.id);
  if(rows.length){const{error}=await SB.from(t).upsert(rows);if(error)throw error}
  const gone=[...(known[k]||[])].filter(i=>!ids.includes(i));
  if(gone.length){const{error}=await SB.from(t).delete().in('id',gone);if(error)throw error}
  known[k]=new Set(ids);
 }
 let e=(await SB.from('lists').delete().gte('id',0)).error;if(e)throw e;
 const rows=LK.flatMap(k=>D[k].map(name=>({kind:k,name})));
 if(rows.length){e=(await SB.from('lists').insert(rows)).error;if(e)throw e}
}
let busy=Promise.resolve();
const save=()=>{busy=busy.then(push).catch(e=>toast('Could not save to database: '+(e.message||e)))};
async function load(){
 try{
  const r=await Promise.all([...TB.map(([,t])=>SB.from(t).select('*')),SB.from('lists').select('*').order('id')]);
  const bad=r.find(x=>x.error);if(bad)throw bad.error;
  if(r.every(x=>!x.data.length)){if(role=='Admin')await push();else for(const k in D)D[k]=[]} /* first run: admin uploads the sample library */
  else{TB.forEach(([k,,,from],i)=>D[k]=r[i].data.map(from));LK.forEach(k=>D[k]=r[TB.length].data.filter(x=>x.kind==k).map(x=>x.name));D.loans.sort((a,b)=>b.issued>a.issued?1:-1);TB.forEach(([k],i)=>known[k]=new Set(r[i].data.map(x=>x.id)))}
 }catch(e){toast('Database error: '+(e.message||e))}
}

/* helpers */
const bk=id=>D.books.find(b=>b.id==id)||{title:'(deleted book)',copies:0};
const mb=id=>D.members.find(m=>m.id==id)||{name:'(deleted member)'};
const open=l=>!l.returned&&!l.lost;
const avail=b=>b.copies-D.loans.filter(l=>l.bookId==b.id&&!l.returned).length;
const stat=l=>l.lost?l.lost:l.returned?'Returned':df(td(),l.due)>0?'Overdue':'Active';
const late=l=>Math.max(0,df(l.returned||td(),l.due));
const staff=()=>role!='Member',mine=x=>staff()||x.memberId==ME;
const tag=s=>`<span class="tag ${/Overdue|Lost|Damaged/.test(s)?'bad':''}">${s}</span>`;
const tbl=(h,r)=>`<div class="tw"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${r.length?r.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${h.length}" class="empty">Nothing here yet.</td></tr>`}</tbody></table></div>`;
const bars=r=>{const m=Math.max(1,...r.map(x=>x[1]));return r.map(([a,b])=>`<div class="bar"><span>${esc(a)}</span><i style="width:${b/m*100}%"></i><em>${b}</em></div>`).join('')||'<p class="empty">No data yet.</p>'};
const toast=m=>{const t=$('#toast');t.textContent=m;t.className='show';setTimeout(()=>t.className='',2600)};
const closeM=()=>$('#modal').hidden=true;
const show=h=>{$('#box').innerHTML=h;$('#modal').hidden=false};
function modal(title,fields,vals,ok,label='Save'){
 show(`<h3>${title}</h3><form>${fields.map(f=>`<label>${f.l}${f.t=='select'?`<select name="${f.k}">${f.o.map(o=>`<option value="${esc(o[0])}" ${o[0]==vals[f.k]?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`:`<input name="${f.k}" type="${f.t||'text'}" value="${esc(vals[f.k]??'')}" required>`}</label>`).join('')}<div class="row"><button type="button" class="ghost" onclick="closeM()">Cancel</button><button class="btn">${label}</button></div></form>`);
 $('#box form').onsubmit=e=>{e.preventDefault();ok(Object.fromEntries(new FormData(e.target)));closeM()};
}
const sel=a=>a.map(x=>[x,x]);

/* books */
const bookForm=id=>{const b=id?bk(id):{author:D.authors[0],publisher:D.publishers[0],category:D.categories[0],copies:1};
 modal(id?'Edit book':'Add book',[{k:'title',l:'Title'},{k:'author',l:'Author',t:'select',o:sel(D.authors)},{k:'publisher',l:'Publisher',t:'select',o:sel(D.publishers)},{k:'category',l:'Category',t:'select',o:sel(D.categories)},{k:'isbn',l:'ISBN'},{k:'copies',l:'Copies',t:'number'}],b,v=>{v.copies=Math.max(1,+v.copies);id?Object.assign(bk(id),v):D.books.unshift({id:uid('b'),...v});save();toast('Book saved');go()})};
const delBook=id=>{if(confirm('Delete this book?')){D.books=D.books.filter(b=>b.id!=id);save();toast('Book deleted');go()}};
const bookTable=()=>{const s=q.toLowerCase();return tbl(['Title','Author','Category','ISBN','Available','Actions'],D.books.filter(b=>(!cf||b.category==cf)&&(b.title+b.author+b.isbn).toLowerCase().includes(s)).map(b=>[esc(b.title),esc(b.author),esc(b.category),esc(b.isbn),`${avail(b)} / ${b.copies}`,staff()?`<button class="ghost s" onclick="bookForm('${b.id}')">Edit</button><button class="ghost s" onclick="issue('${b.id}')">Issue</button><button class="ghost s danger" onclick="delBook('${b.id}')">Delete</button>`:`<button class="ghost s" onclick="reserve('${b.id}')">Reserve</button>`]))};

/* authors, publishers, categories */
const addMeta=k=>modal('Add '+k.replace(/s$/,'').replace('categorie','category'),[{k:'n',l:'Name'}],{},v=>{D[k].push(v.n);save();go()});
const delMeta=(k,i)=>{D[k].splice(i,1);save();go()};

/* members */
const memForm=id=>{const m=id?mb(id):{type:'Student'};modal(id?'Edit member':'Register member',[{k:'name',l:'Full name'},{k:'email',l:'Email',t:'email'},{k:'type',l:'Type',t:'select',o:sel(['Student','Staff','Public'])}],m,v=>{id?Object.assign(mb(id),v):D.members.push({id:uid('M'),...v});save();toast(id?'Member updated':'Registered. You can now sign in.');if(role)go()},id?'Save':'Register')};
const delMem=id=>{if(confirm('Delete this member?')){D.members=D.members.filter(m=>m.id!=id);save();go()}};
const hist=id=>show(`<h3>${esc(mb(id).name)}: borrowing history</h3>${tbl(['Book','Issued','Due','Status'],D.loans.filter(l=>l.memberId==id).map(l=>[esc(bk(l.bookId).title),l.issued,l.due,tag(stat(l))]))}<div class="row"><button class="btn" onclick="closeM()">Close</button></div>`);

/* circulation */
const issue=bookId=>{const o=D.books.filter(b=>avail(b)>0).map(b=>[b.id,b.title]);if(!o.length)return toast('No copies available');
 modal('Issue book',[{k:'bookId',l:'Book',t:'select',o},{k:'memberId',l:'Member',t:'select',o:D.members.map(m=>[m.id,m.name])},{k:'due',l:'Due date',t:'date'}],{bookId,memberId:D.members[0]?.id,due:add(td(),14)},v=>{D.loans.unshift({id:uid('L'),...v,issued:td(),renewals:0});save();toast('Book issued');go()},'Issue')};
const L=id=>D.loans.find(x=>x.id==id);
const ret=id=>{const l=L(id);l.returned=td();const d=late(l);if(d>0)D.fines.unshift({id:uid('F'),memberId:l.memberId,why:`Overdue ${d} day(s): ${bk(l.bookId).title}`,amt:d*FINE,paid:false,date:td()});save();toast(d>0?`Returned. Fine Rs ${d*FINE}`:'Book returned');go()};
const renew=id=>{const l=L(id);if(l.renewals>=2)return toast('Renewal limit reached (2)');if(D.res.some(r=>r.bookId==l.bookId))return toast('Someone has reserved this book');l.due=add(l.due,7);l.renewals++;save();toast('Renewed for 7 days');go()};
const flag=(id,k)=>{const l=L(id);l.lost=k;if(k=='Damaged')l.returned=td();D.fines.unshift({id:uid('F'),memberId:l.memberId,why:`${k}: ${bk(l.bookId).title}`,amt:k=='Lost'?1500:500,paid:false,date:td()});save();toast(`${k} recorded, fine added`);go()};
const reserve=bookId=>{const push=v=>{D.res.push({id:uid('R'),...v,date:td()});save();toast('Reservation placed');go()};
 role=='Member'?push({bookId,memberId:ME}):modal('Reserve book',[{k:'bookId',l:'Book',t:'select',o:D.books.map(b=>[b.id,b.title])},{k:'memberId',l:'Member',t:'select',o:D.members.map(m=>[m.id,m.name])}],{bookId},push,'Reserve')};
const cancelRes=id=>{D.res=D.res.filter(r=>r.id!=id);save();go()};
const payFine=id=>{const f=D.fines.find(x=>x.id==id);f.paid=true;f.paidOn=td();save();toast('Payment recorded');go()};

/* notifications */
const notes=()=>{const n=[];D.loans.filter(l=>open(l)&&mine(l)).forEach(l=>{const d=df(l.due,td()),w=staff()?` (${esc(mb(l.memberId).name)})`:'';if(d<0)n.push(['Overdue',`${esc(bk(l.bookId).title)} is ${-d} day(s) overdue${w}`]);else if(d<=3)n.push(['Due soon',`${esc(bk(l.bookId).title)} is due in ${d} day(s)${w}`])});
 D.res.filter(r=>mine(r)&&avail(bk(r.bookId))>0).forEach(r=>n.push(['Reservation',`${esc(bk(r.bookId).title)} is available for ${esc(mb(r.memberId).name)}`]));return n};

/* settings */
const backup=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,1)],{type:'application/json'}));a.download='aura-backup.json';a.click()};
const restore=e=>{const f=e.target.files[0];if(f)f.text().then(t=>{try{D=JSON.parse(t);save();toast('Backup restored');go()}catch{toast('That file is not a valid backup')}})};
const pass=()=>modal('Change password',[{k:'b',l:'New password (6+ characters)',t:'password'},{k:'c',l:'Confirm new password',t:'password'}],{},v=>v.b==v.c?SB.auth.updateUser({password:v.b}).then(r=>toast(r.error?r.error.message:'Password updated')):toast('Passwords do not match'),'Update');
async function loadUsers(){const r=await SB.from('profiles').select('*').order('email');if(r.error||!$('#ur'))return;$('#ur').innerHTML='<h3>User roles</h3>'+tbl(['Name','Email','Role'],r.data.map(u=>[esc(u.name||''),esc(u.email),`<select onchange="setRole('${u.id}',this.value)">${['Admin','Librarian','Member'].map(x=>`<option ${x==u.role?'selected':''}>${x}</option>`).join('')}</select>`]))}
const setRole=async(id,r)=>{const e=(await SB.from('profiles').update({role:r}).eq('id',id)).error;toast(e?e.message:'Role updated')};
const reset=()=>{if(confirm('Reset all data to the sample library?')){D=seed();save();go()}};

/* views */
const V={
 dash(){const t=D.books.reduce((s,b)=>s+b.copies,0),iss=D.loans.filter(l=>!l.returned).length,ov=D.loans.filter(l=>stat(l)=='Overdue').length,cnt={},cat={};
  D.loans.forEach(l=>cnt[l.bookId]=(cnt[l.bookId]||0)+1);D.books.forEach(b=>cat[b.category]=(cat[b.category]||0)+b.copies);
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]),rec=D.books.filter(b=>avail(b)>0).sort((a,b)=>(cnt[b.id]||0)-(cnt[a.id]||0)).slice(0,3);
  return `<div class="stats">${[['Total copies',t],['Available',t-iss],['Issued',iss],['Overdue',ov],['Active members',D.members.length]].map(([a,b])=>`<div class="card stat"><b>${b}</b><span>${a}</span></div>`).join('')}</div>
  <div class="grid2"><div class="card"><h3>Most borrowed books</h3>${bars(top.slice(0,5).map(([id,n])=>[bk(id).title,n]))}</div><div class="card"><h3>Copies by category</h3>${bars(Object.entries(cat))}</div></div>
  <div class="card"><h3>Recommended to read next</h3><div class="recs">${rec.map(b=>`<div><b>${esc(b.title)}</b><br><small>${esc(b.author)}</small></div>`).join('')||'<p class="empty">No recommendations yet.</p>'}</div></div>`},
 books(){return `<div class="bar2"><input id="bq" placeholder="Search by title, author or ISBN" value="${esc(q)}"><select id="bc"><option value="">All categories</option>${D.categories.map(c=>`<option ${c==cf?'selected':''}>${esc(c)}</option>`).join('')}</select>${staff()?'<button class="btn" onclick="bookForm()">Add book</button>':''}</div><div id="bt">${bookTable()}</div>`},
 meta(){return `<div class="grid3">${[['authors','Authors'],['publishers','Publishers'],['categories','Categories']].map(([k,n])=>`<div class="card"><div class="ch"><h3>${n}</h3><button class="btn s" onclick="addMeta('${k}')">Add</button></div>${D[k].map((x,i)=>`<div class="li"><span>${esc(x)}</span><button class="ghost s danger" onclick="delMeta('${k}',${i})">Delete</button></div>`).join('')}</div>`).join('')}</div>`},
 members(){return `<div class="bar2"><button class="btn" onclick="memForm()">Add member</button></div>${tbl(['Name','Email','Type','Borrowed','Actions'],D.members.map(m=>[esc(m.name),esc(m.email),m.type,D.loans.filter(l=>l.memberId==m.id&&open(l)).length,`<button class="ghost s" onclick="hist('${m.id}')">History</button><button class="ghost s" onclick="memForm('${m.id}')">Edit</button><button class="ghost s danger" onclick="delMem('${m.id}')">Delete</button>`]))}`},
 circ(){const ls=D.loans.filter(mine);return `<div class="bar2">${staff()?'<button class="btn" onclick="issue()">Issue book</button>':''}<button class="ghost" onclick="reserve()">Reserve book</button></div>
  <h3>Loans</h3>${tbl(['Book','Member','Issued','Due','Renewals','Status','Actions'],ls.map(l=>[esc(bk(l.bookId).title),esc(mb(l.memberId).name),l.issued,l.due,l.renewals+'/2',tag(stat(l)),open(l)?`<button class="ghost s" onclick="renew('${l.id}')">Renew</button>${staff()?`<button class="ghost s" onclick="ret('${l.id}')">Return</button><button class="ghost s danger" onclick="flag('${l.id}','Lost')">Lost</button><button class="ghost s danger" onclick="flag('${l.id}','Damaged')">Damaged</button>`:''}`:'']))}
  <h3>Reservations</h3>${tbl(['Book','Member','Placed','Copy available','Actions'],D.res.filter(mine).map(r=>[esc(bk(r.bookId).title),esc(mb(r.memberId).name),r.date,avail(bk(r.bookId))>0?tag('Yes'):'No',`<button class="ghost s" onclick="cancelRes('${r.id}')">Cancel</button>`]))}`},
 fines(){const f=D.fines.filter(mine),p=f.filter(x=>!x.paid).reduce((s,x)=>s+x.amt,0),c=f.filter(x=>x.paid).reduce((s,x)=>s+x.amt,0);
  return `<div class="stats"><div class="card stat"><b>Rs ${p}</b><span>Pending fines</span></div><div class="card stat"><b>Rs ${c}</b><span>Collected</span></div><div class="card stat"><b>Rs ${FINE}</b><span>Fine per day</span></div></div>${tbl(['Member','Reason','Amount','Date','Status','Payment'],f.map(x=>[esc(mb(x.memberId).name),esc(x.why),'Rs '+x.amt,x.date,x.paid?tag('Paid '+x.paidOn):tag('Overdue'),!x.paid&&staff()?`<button class="ghost s" onclick="payFine('${x.id}')">Mark paid</button>`:'']))}`},
 notes(){const n=notes();return `<div class="card">${n.map(([t,m])=>`<div class="note">${tag(t)}<span>${m}</span></div>`).join('')||'<p class="empty">You are all caught up.</p>'}</div>`},
 reports(){const m=td().slice(0,7),ov=D.loans.filter(l=>stat(l)=='Overdue');
  return `<div class="stats"><div class="card stat"><b>${D.loans.filter(l=>l.issued==td()).length}</b><span>Borrowed today</span></div><div class="card stat"><b>${D.loans.filter(l=>l.issued.startsWith(m)).length}</b><span>Borrowed this month</span></div><div class="card stat"><b>Rs ${D.fines.filter(x=>x.paid).reduce((s,x)=>s+x.amt,0)}</b><span>Fines collected</span></div><div class="card stat"><b>${ov.length}</b><span>Overdue now</span></div></div>
  <div class="bar2"><button class="btn" onclick="window.print()">Print reports</button></div><h3>Overdue report</h3>${tbl(['Book','Member','Due','Days late','Fine so far'],ov.map(l=>[esc(bk(l.bookId).title),esc(mb(l.memberId).name),l.due,late(l),'Rs '+late(l)*FINE]))}
  <h3>Inventory report</h3>${tbl(['Title','Copies','Available','Issued'],D.books.map(b=>[esc(b.title),b.copies,avail(b),b.copies-avail(b)]))}`},
 set(){return `<div class="grid3"><div class="card"><h3>Security</h3><p class="mut">Update your password.</p><br><button class="btn" onclick="pass()">Change password</button></div><div class="card"><h3>Backup and restore</h3><p class="mut">Save all library data to a file, or load one.</p><br><button class="btn" onclick="backup()">Download backup</button><br><br><input type="file" accept=".json" onchange="restore(event)"></div><div class="card"><h3>Sample data</h3><p class="mut">Replace everything with the demo library.</p><br><button class="ghost danger" onclick="reset()">Reset data</button></div><div class="card" id="ur" style="grid-column:1/-1"></div></div>`}
};
const NAV=[['dash','Dashboard','ALM'],['books','Books','ALM'],['meta','Authors and categories','AL'],['members','Members','AL'],['circ','Issue and return','ALM'],['fines','Fines','ALM'],['notes','Notifications','ALM'],['reports','Reports','AL'],['set','Settings','A']];

function go(){
 $('#title').textContent=NAV.find(x=>x[0]==tab)[1];
 $('#nav').innerHTML=NAV.filter(x=>x[2].includes(role[0])).map(x=>`<a href="#" class="${x[0]==tab?'on':''}" onclick="tab='${x[0]}';go();return false">${x[1]}</a>`).join('');
 $('#view').innerHTML=V[tab]();$('#bell').textContent='Alerts '+notes().length;
 if(tab=='set')loadUsers();
 if($('#bq')){$('#bq').oninput=e=>{q=e.target.value;$('#bt').innerHTML=bookTable()};$('#bc').onchange=e=>{cf=e.target.value;$('#bt').innerHTML=bookTable()}}
}

/* login, theme, header buttons */
let signup=false;
$('#reg').onclick=e=>{e.preventDefault();signup=!signup;$('#nm').hidden=!signup;$('#lf .btn').textContent=signup?'Create account':'Sign in';e.target.textContent=signup?'I already have an account':'Create an account'};
$('#lf').onsubmit=async e=>{e.preventDefault();const m=$('#lm');m.textContent='Please wait…';
 const c={email:$('#em').value,password:$('#pw').value};
 const r=signup?await SB.auth.signUp({...c,options:{data:{name:$('#nm').value}}}):await SB.auth.signInWithPassword(c);
 if(r.error){m.textContent=r.error.message;return}
 if(!r.data.session){m.textContent='Check your email to confirm the account, then sign in.';return}
 m.textContent='';enter(r.data.user)};
async function enter(u){
 const p=await SB.from('profiles').select('role,name').eq('id',u.id).single();
 if(p.error){toast('Profile not found: '+p.error.message);return SB.auth.signOut()}
 role=p.data.role;who=u.email;ME=u.id;await load();
 if(role=='Member'&&!D.members.some(m=>m.id==ME)){D.members.push({id:ME,name:p.data.name||u.email,email:u.email,type:'Student'});save()}
 tab='dash';$('#login').hidden=true;$('#app').hidden=false;$('#who').textContent=who+' ('+role+')';go()}
$('#out').onclick=async()=>{await SB.auth.signOut();location.reload()};
$('#bell').onclick=()=>{tab='notes';go()};
$('#gs').onkeydown=e=>{if(e.key=='Enter'){q=e.target.value;cf='';tab='books';go()}};
const theme=t=>{document.documentElement.dataset.theme=t;localStorage.th=t;$('#theme').textContent=t=='dark'?'Light mode':'Dark mode'};
$('#theme').onclick=()=>theme(document.documentElement.dataset.theme=='dark'?'light':'dark');
theme(localStorage.th||'light');
$('#modal').onclick=e=>{if(e.target.id=='modal')closeM()};
$('#scan').onclick=()=>{show('<h3>Scan barcode or QR code</h3><div class="scanner"><div class="line"></div></div><p id="sr" class="mut">Hold the code steady in the frame…</p><div class="row"><button class="ghost" onclick="closeM()">Close</button></div>');
 setTimeout(()=>{const b=D.books[Math.floor(Math.random()*D.books.length)];if(!b||$('#modal').hidden)return;$('#sr').innerHTML=`Found <b>${esc(b.title)}</b><br>ISBN ${esc(b.isbn)}<br><br><button class="btn s" onclick="closeM();${staff()?`issue('${b.id}')`:`reserve('${b.id}')`}">${staff()?'Issue this book':'Reserve this book'}</button>`},1500)};
SB.auth.getSession().then(({data})=>{if(data.session)enter(data.session.user)});