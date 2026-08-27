const $=id=>document.getElementById(id);
const ids=["camera","cameraEmpty","startCamera","toggleCamMode","capture","fileInput","result","preview","amount","save","manual","manualDialog","manualAmount","manualTime","timeFieldGroup","displayTime","applyManual","rescan","canvas","success","shareText","share","copy","again","toast","scanTab","historyTab","scanPage","historyPage","historyDate","historyLoading","historyEmpty","historyList","recapBox","historyTotal","shareRecap","copyRecap","deleteDialog","deleteConfirmInfo","deletePinInput","deletePasswordInput","confirmDeleteBtn"];
const e=Object.fromEntries(ids.map(id=>[id,$(id)]));
let stream,imageBlob,amount=0,recapText="",originalTime="",pendingDeleteRecord=null;
let inputSource="camera";
let currentFacingMode=localStorage.getItem("preferredFacingMode")||"user";

const rupiah=n=>new Intl.NumberFormat("id-ID").format(n);
const toast=t=>{e.toast.textContent=t;e.toast.classList.add("show");setTimeout(()=>e.toast.classList.remove("show"),2200)};
const localDate=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`};
const currentJakartaTime=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.hour}:${v.minute}`};

// Cek apakah context aman (HTTPS atau localhost)
const isSecureContext=()=>location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"||location.hostname.endsWith(".local");

function updateCamToggleBtnText(){
  if(!e.toggleCamMode)return;
  const isUser=currentFacingMode==="user";
  e.toggleCamMode.textContent=isUser?"📷 Depan":"📷 Belakang";
}

function toggleCamera(){
  currentFacingMode=currentFacingMode==="environment"?"user":"environment";
  localStorage.setItem("preferredFacingMode",currentFacingMode);
  updateCamToggleBtnText();
  startCamera();
}

async function startCamera(){
  if(!isSecureContext()){toast("Kamera butuh HTTPS. Buka via https:// atau localhost.");return}
  if(!("mediaDevices" in navigator)){toast("Browser tidak mendukung kamera.");return}

  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}

  updateCamToggleBtnText();

  const targetMode=currentFacingMode;
  const fallbackMode=targetMode==="environment"?"user":"environment";

  const constraints=[
    {video:{facingMode:{exact:targetMode},width:{ideal:1280},height:{ideal:720}},audio:false},
    {video:{facingMode:{ideal:targetMode},width:{ideal:1280},height:{ideal:720}},audio:false},
    {video:{facingMode:{exact:fallbackMode},width:{ideal:1280},height:{ideal:720}},audio:false},
    {video:{facingMode:{ideal:fallbackMode},width:{ideal:1280},height:{ideal:720}},audio:false},
    {video:true,audio:false}
  ];

  let lastError;
  for(const c of constraints){
    try{
      stream=await navigator.mediaDevices.getUserMedia(c);
      e.camera.srcObject=null;
      e.camera.srcObject=stream;

      await new Promise((resolve)=>{
        e.camera.onloadedmetadata=()=>{
          e.camera.onloadedmetadata=null;
          resolve();
        };
        setTimeout(resolve, 2000);
      });

      await e.camera.play().catch(()=>{});

      e.cameraEmpty.classList.add("hidden");
      e.startCamera.classList.add("hidden");
      e.capture.disabled=false;
      return;
    }catch(err){lastError=err}
  }
  console.error("Camera error:",lastError);
  toast("Kamera gagal dibuka. Pilih foto dari galeri.");
}

const canvasBlob=(c,q=.78)=>new Promise(r=>c.toBlob(r,"image/jpeg",q));

function openManual(mode="default"){
  e.manualAmount.value=amount?rupiah(amount):"";
  if(e.manualTime && e.displayTime)e.manualTime.value=e.displayTime.value||originalTime;
  
  // Jika jepret kamera, sembunyikan input jam agar cepat langsung isi nominal
  // Jika dari galeri atau tombol edit manual, tampilkan input jam
  if(e.timeFieldGroup){
    e.timeFieldGroup.style.display=(mode==="camera"&&inputSource==="camera")?"none":"";
  }

  e.manualDialog.showModal();
  setTimeout(()=>e.manualAmount.focus(),100);
}

async function useSource(s, source="camera"){
  inputSource=source;
  const w=s.videoWidth||s.naturalWidth,h=s.videoHeight||s.naturalHeight,max=1100,z=Math.min(1,max/w);
  e.canvas.width=Math.round(w*z);e.canvas.height=Math.round(h*z);
  e.canvas.getContext("2d").drawImage(s,0,0,e.canvas.width,e.canvas.height);
  imageBlob=await canvasBlob(e.canvas);
  e.preview.src=URL.createObjectURL(imageBlob);
  amount=0;e.amount.textContent="0";
  
  const nowT=currentJakartaTime();
  originalTime=nowT;
  if(e.displayTime)e.displayTime.value=nowT;
  if(e.manualTime)e.manualTime.value=nowT;

  e.result.classList.remove("hidden");
  e.success.classList.add("hidden");
  e.result.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>openManual(source),250);
}

async function save(){
  if(!amount)return openManual(inputSource);
  e.save.disabled=true;e.save.textContent="Menyimpan…";
  try{
    const fd=new FormData();
    fd.append("image",imageBlob,"bukti-qris.jpg");
    fd.append("amount",String(amount));

    const selectedTime=e.displayTime?.value||e.manualTime?.value;
    if(selectedTime){
      fd.append("customTime",selectedTime);
    }

    const response=await fetch("/api/receipts",{method:"POST",body:fd});
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.error);
    }

    const time=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(data.savedAt));
    e.shareText.textContent=`${time} - ${rupiah(data.amount)} gambar ${data.imageUrl}`;
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
  }catch(x){toast(x.message||"Gagal menyimpan");}
  finally{e.save.disabled=false;e.save.textContent="Simpan";}
}

function reset(){
  e.result.classList.add("hidden");
  e.success.classList.add("hidden");
  imageBlob=null;amount=0;
  window.scrollTo({top:0,behavior:"smooth"});
}

function showPage(page){
  const h=page==="history";
  e.scanPage.classList.toggle("hidden",h);
  e.historyPage.classList.toggle("hidden",!h);
  e.scanTab.classList.toggle("active",!h);
  e.historyTab.classList.toggle("active",h);
  if(h)loadHistory();
}

function titleDate(d){return new Intl.DateTimeFormat("id-ID",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${d}T00:00:00Z`));}

async function editRecord(record){
  const currentTime=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(record.savedAt));
  const newAmountStr=prompt("Edit Nominal Rupiah:",record.amount);
  if(newAmountStr===null)return;
  const newTimeStr=prompt("Edit Jam (format HH:mm):",currentTime);
  if(newTimeStr===null)return;
  let pin=sessionStorage.getItem("deletePin")||prompt("Masukkan 6-digit PIN:");
  if(!pin)return;
  try{
    const response=await fetch("/api/receipts",{
      method:"PUT",
      headers:{"content-type":"application/json","x-delete-pin":pin},
      body:JSON.stringify({recordKey:record.recordKey,newAmount:Number(newAmountStr),newTime:newTimeStr})
    });
    const data=await response.json();
    if(!response.ok){if(response.status===401)sessionStorage.removeItem("deletePin");throw new Error(data.error);}
    sessionStorage.setItem("deletePin",pin);
    toast("Transaksi berhasil diperbarui");
    await loadHistory();
  }catch(x){toast(x.message||"Gagal mengedit transaksi");}
}

function removeRecord(record){
  pendingDeleteRecord=record;
  const time=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(record.savedAt));
  if(e.deleteConfirmInfo)e.deleteConfirmInfo.textContent=`Hapus transaksi Rp${rupiah(record.amount)} (${time} WIB) beserta foto bukti di R2?`;
  if(e.deletePinInput)e.deletePinInput.value=sessionStorage.getItem("deletePin")||"";
  if(e.deletePasswordInput)e.deletePasswordInput.value=sessionStorage.getItem("deletePassword")||"";
  if(e.deleteDialog)e.deleteDialog.showModal();
}

async function handleConfirmDelete(x){
  x.preventDefault();
  if(!pendingDeleteRecord)return;
  const pin=e.deletePinInput?.value;
  const password=e.deletePasswordInput?.value;
  if(!pin||!password){
    return toast("Wajib mengisi Verifikasi 1 (PIN) & Verifikasi 2 (Password Admin)");
  }
  try{
    const response=await fetch("/api/receipts",{
      method:"DELETE",
      headers:{
        "content-type":"application/json",
        "x-delete-pin":pin,
        "x-delete-password":password
      },
      body:JSON.stringify({recordKey:pendingDeleteRecord.recordKey})
    });
    const data=await response.json();
    if(!response.ok){
      if(response.status===401){
        sessionStorage.removeItem("deletePin");
        sessionStorage.removeItem("deletePassword");
      }
      throw new Error(data.error);
    }
    sessionStorage.setItem("deletePin",pin);
    sessionStorage.setItem("deletePassword",password);
    if(e.deleteDialog)e.deleteDialog.close();
    toast("Transaksi dihapus (Verifikasi 2-Langkah Sukses)");
    pendingDeleteRecord=null;
    await loadHistory();
  }catch(err){
    toast(err.message||"Gagal menghapus transaksi");
  }
}

async function loadHistory(init=false){
  const date=e.historyDate.value||localDate();
  e.historyLoading.classList.remove("hidden");
  e.historyEmpty.classList.add("hidden");
  e.recapBox.classList.add("hidden");
  e.historyList.innerHTML="";
  try{
    const response=await fetch(`/api/receipts?date=${encodeURIComponent(date)}`),data=await response.json();
    if(response.status===401)return location.href="/login";
    if(!response.ok)throw new Error(data.error);

    if(data.role==="guest"){
      e.scanTab.style.display="none";
      if(!e.scanPage.classList.contains("hidden")){
        e.scanPage.classList.add("hidden");
        e.historyPage.classList.remove("hidden");
        e.scanTab.classList.remove("active");
        e.historyTab.classList.add("active");
      }
    } else if(init && isSecureContext() && "mediaDevices" in navigator){
      startCamera();
    }

    if(!data.records.length){e.historyEmpty.classList.remove("hidden");return;}
    let total=0;const lines=[],links=[];
    for(const [index,r] of data.records.entries()){
      total+=r.amount;
      const time=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(r.savedAt));
      lines.push(`${index+1}. ${time} - ${rupiah(r.amount)}`);
      links.push(`${index+1}. ${r.imageUrl}`);
      const item=document.createElement("article");
      item.className="history-item";
      item.innerHTML=`<img src="${r.imageUrl}" alt="Bukti QRIS" loading="lazy"><div><time>${time} WIB</time><strong>Rp${rupiah(r.amount)}</strong><a href="${r.imageUrl}" target="_blank" rel="noopener">Lihat foto</a></div>${data.role==="admin"?'<div class="history-item-actions"><button class="edit-record">Edit</button><button class="delete-record">Hapus</button></div>':""}`;
      if(data.role==="admin"){
        item.querySelector(".edit-record").onclick=()=>editRecord(r);
        item.querySelector(".delete-record").onclick=()=>removeRecord(r);
      }
      e.historyList.append(item);
    }
    recapText=`*REKAP TRANSAKSI QRIS (${titleDate(date)})*\n\n${lines.join("\n")}\n\n*Total QRIS: ${rupiah(total)}*\n\nLink bukti:\n${links.join("\n")}`;
    e.historyTotal.textContent=`Rp${rupiah(total)}`;
    e.recapBox.classList.remove("hidden");
  }catch(x){toast(x.message||"Riwayat gagal dimuat");}
  finally{e.historyLoading.classList.add("hidden");}
}

async function shareText(t){if(navigator.share)await navigator.share({text:t});else window.open(`https://wa.me/?text=${encodeURIComponent(t)}`,"_blank");}

// Event listeners
if(e.toggleCamMode)e.toggleCamMode.onclick=toggleCamera;
updateCamToggleBtnText();
e.startCamera.onclick=startCamera;
e.capture.onclick=()=>useSource(e.camera,"camera");
e.rescan.onclick=reset;
e.again.onclick=reset;
e.save.onclick=save;
e.manual.onclick=()=>openManual("manual_edit");
e.scanTab.onclick=()=>showPage("scan");
e.historyTab.onclick=()=>showPage("history");
e.historyDate.onchange=loadHistory;

if(e.confirmDeleteBtn)e.confirmDeleteBtn.onclick=handleConfirmDelete;

if(e.displayTime){
  e.displayTime.onchange=()=>{
    if(e.manualTime)e.manualTime.value=e.displayTime.value;
  };
}

e.fileInput.onchange=()=>{
  const f=e.fileInput.files[0];
  if(!f)return;
  const img=new Image();
  img.onload=()=>{useSource(img,"gallery");URL.revokeObjectURL(img.src);};
  img.src=URL.createObjectURL(f);
};

e.manualAmount.oninput=()=>{const d=e.manualAmount.value.replace(/\D/g,"");e.manualAmount.value=d?rupiah(Number(d)):"";};

e.applyManual.onclick=x=>{
  x.preventDefault();
  const n=Number(e.manualAmount.value.replace(/\D/g,""));
  if(!n)return toast("Masukkan nominal yang benar");
  amount=n;
  e.amount.textContent=rupiah(n);
  if(e.manualTime && e.displayTime)e.displayTime.value=e.manualTime.value;
  e.manualDialog.close();
};

e.share.onclick=()=>shareText(e.shareText.textContent);
e.copy.onclick=async()=>{await navigator.clipboard.writeText(e.shareText.textContent);toast("Teks disalin");};
e.shareRecap.onclick=()=>shareText(recapText);
e.copyRecap.onclick=async()=>{await navigator.clipboard.writeText(recapText);toast("Rekap disalin");};

e.historyDate.value=localDate();
loadHistory(true);
