const $=id=>document.getElementById(id);
const ids=[
  "camera","cameraEmpty","startCamera","toggleCamMode","capture","nativeCamInput","fileInput",
  "result","preview","amount","save","manual","manualDialog","manualAmount","manualDate","manualTime",
  "dateTimeFieldGroup","displayDate","displayTime","applyManual","rescan","canvas","success","shareText","share","copy",
  "again","toast","scanTab","historyTab","scanPage","historyPage","historyDate","historyLoading",
  "historyEmpty","historyList","recapBox","historyTotal","shareRecap","copyRecap",
  "deleteDialog","deleteConfirmInfo","deletePinInput","deletePasswordInput","confirmDeleteBtn",
  "externalShortcut","settingsBtn","settingsDialog","settingDefaultCam","settingShortcutEnabled",
  "settingShortcutLabel","settingShortcutUrl","shortcutFields","settingRetentionDays","cleanNowBtn","saveSettingsBtn"
];
const e=Object.fromEntries(ids.map(id=>[id,$(id)]));
let stream,imageBlob,amount=0,recapText="",originalTime="",originalDate="",pendingDeleteRecord=null;
let inputSource="camera";
let currentFacingMode=localStorage.getItem("preferredFacingMode")||"environment";
let allVideoDevices=[];
let currentDeviceIndex=0;
let currentRole="kasir";

const rupiah=n=>new Intl.NumberFormat("id-ID").format(n);
const toast=t=>{e.toast.textContent=t;e.toast.classList.add("show");setTimeout(()=>e.toast.classList.remove("show"),2800)};
const localDate=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`};
const currentJakartaTime=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.hour}:${v.minute}`};

// Cek apakah context aman (HTTPS atau localhost)
const isSecureContext=()=>location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"||location.hostname.endsWith(".local");

function loadSettings(){
  const facing=localStorage.getItem("preferredFacingMode")||"environment";
  const shortcutEnabled=localStorage.getItem("shortcutEnabled")!=="false";
  const shortcutLabel=localStorage.getItem("shortcutLabel")||"Web Utama";
  const shortcutUrl=localStorage.getItem("shortcutUrl")||"https://tahunyakrispiya.my.id";
  return {facing,shortcutEnabled,shortcutLabel,shortcutUrl};
}

function applySettingsUI(s){
  currentFacingMode=s.facing;
  updateCamToggleBtnText();

  // Jika mode intip (guest), sembunyikan pengaturan dan web utama secara mutlak
  if(currentRole==="guest"){
    if(e.settingsBtn) e.settingsBtn.style.display="none";
    if(e.externalShortcut) e.externalShortcut.style.display="none";
    return;
  }

  if(e.settingsBtn){
    e.settingsBtn.style.display="inline-flex";
  }

  if(e.externalShortcut){
    if(s.shortcutEnabled){
      e.externalShortcut.style.display="inline-flex";
      e.externalShortcut.innerHTML=`<span>${s.shortcutLabel}</span>`;
      e.externalShortcut.href=s.shortcutUrl;
    }else{
      e.externalShortcut.style.display="none";
    }
  }
}

async function openSettingsModal(){
  if(currentRole==="guest") return; // Mode intip tidak boleh akses pengaturan
  const s=loadSettings();
  if(e.settingDefaultCam)e.settingDefaultCam.value=s.facing;
  if(e.settingShortcutEnabled){
    e.settingShortcutEnabled.checked=s.shortcutEnabled;
    if(e.shortcutFields)e.shortcutFields.style.display=s.shortcutEnabled?"flex":"none";
  }
  if(e.settingShortcutLabel)e.settingShortcutLabel.value=s.shortcutLabel;
  if(e.settingShortcutUrl)e.settingShortcutUrl.value=s.shortcutUrl;

  try{
    const res=await fetch("/api/config/retention");
    if(res.ok){
      const data=await res.json();
      if(e.settingRetentionDays && typeof data.retentionDays!=="undefined"){
        e.settingRetentionDays.value=String(data.retentionDays);
      }
    }
  }catch(_){}

  if(e.settingsDialog)e.settingsDialog.showModal();
}

async function saveSettings(ev){
  ev.preventDefault();
  const facing=e.settingDefaultCam?.value||"environment";
  const shortcutEnabled=e.settingShortcutEnabled?e.settingShortcutEnabled.checked:true;
  const shortcutLabel=(e.settingShortcutLabel?.value||"Web Utama").trim()||"Web Utama";
  let shortcutUrl=(e.settingShortcutUrl?.value||"").trim();
  if(!shortcutUrl)shortcutUrl="https://tahunyakrispiya.my.id";
  else if(!/^https?:\/\//i.test(shortcutUrl))shortcutUrl="https://"+shortcutUrl;

  const retentionDays=Number(e.settingRetentionDays?.value||30);

  try{
    await fetch("/api/config/retention",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({retentionDays})
    });
  }catch(_){}

  const prevFacing=currentFacingMode;
  localStorage.setItem("preferredFacingMode",facing);
  localStorage.setItem("shortcutEnabled",String(shortcutEnabled));
  localStorage.setItem("shortcutLabel",shortcutLabel);
  localStorage.setItem("shortcutUrl",shortcutUrl);

  applySettingsUI({facing,shortcutEnabled,shortcutLabel,shortcutUrl});
  if(e.settingsDialog)e.settingsDialog.close();
  toast("Pengaturan & siklus retensi disimpan");

  if(prevFacing!==facing){
    startCamera();
  }
}

function updateCamToggleBtnText(){
  if(!e.toggleCamMode)return;
  const isUser=currentFacingMode==="user";
  const iconSvg=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8c0 2 .7 3.8 2 5.3L4 18h5v-5l-1.8 1.8A6 6 0 1 1 18 10"/><path d="m14 14 2 2 4-4"/></svg>`;
  e.toggleCamMode.innerHTML=`${iconSvg} <span>${isUser?"Kamera Depan":"Kamera Belakang"}</span>`;
}

async function toggleCamera(){
  if(allVideoDevices.length>1){
    currentDeviceIndex=(currentDeviceIndex+1)%allVideoDevices.length;
    const dev=allVideoDevices[currentDeviceIndex];
    const label=(dev.label||"").toLowerCase();
    const isFront=label.includes("front")||label.includes("user")||label.includes("depan")||label.includes("selfie")||label.includes("1");
    currentFacingMode=isFront?"user":"environment";
  }else{
    currentFacingMode=currentFacingMode==="environment"?"user":"environment";
  }
  localStorage.setItem("preferredFacingMode",currentFacingMode);
  updateCamToggleBtnText();
  await startCamera();
}

async function refreshVideoDevices(){
  if("mediaDevices" in navigator && typeof navigator.mediaDevices.enumerateDevices === "function"){
    try{
      const devices=await navigator.mediaDevices.enumerateDevices();
      allVideoDevices=devices.filter(d=>d.kind==="videoinput");
    }catch(_){}
  }
}

async function getCameraStream(targetMode){
  if(stream){
    stream.getTracks().forEach(t=>{
      try{ t.stop(); }catch(_){}
    });
    stream=null;
  }
  if(e.camera.srcObject){
    e.camera.srcObject=null;
  }
  await new Promise(r=>setTimeout(r,150));

  await refreshVideoDevices();

  const constraintsList=[];

  if(allVideoDevices.length>0){
    if(targetMode==="environment"){
      const backDevs=allVideoDevices.filter(d=>{
        const l=(d.label||"").toLowerCase();
        if(l.includes("back")||l.includes("rear")||l.includes("environment")||l.includes("belakang")||l.includes("camera2 0")||l.includes("0, facing back")||l.includes("main")) return true;
        if(!l.includes("front")&&!l.includes("user")&&!l.includes("depan")&&!l.includes("selfie")&&!l.includes("1")) return true;
        return false;
      });
      for(const b of backDevs){
        if(b.deviceId) constraintsList.push({video:{deviceId:{exact:b.deviceId}},audio:false});
      }
    }else{
      const frontDevs=allVideoDevices.filter(d=>{
        const l=(d.label||"").toLowerCase();
        return l.includes("front")||l.includes("user")||l.includes("depan")||l.includes("selfie")||l.includes("1, facing front");
      });
      for(const f of frontDevs){
        if(f.deviceId) constraintsList.push({video:{deviceId:{exact:f.deviceId}},audio:false});
      }
    }
  }

  if(targetMode==="environment"){
    constraintsList.push({video:{facingMode:{exact:"environment"}},audio:false});
    constraintsList.push({video:{facingMode:"environment"},audio:false});
    constraintsList.push({video:{facingMode:{ideal:"environment"}},audio:false});
  }else{
    constraintsList.push({video:{facingMode:{exact:"user"}},audio:false});
    constraintsList.push({video:{facingMode:"user"},audio:false});
    constraintsList.push({video:{facingMode:{ideal:"user"}},audio:false});
  }

  let lastError=null;
  for(const c of constraintsList){
    try{
      const s=await navigator.mediaDevices.getUserMedia(c);
      await refreshVideoDevices();
      return s;
    }catch(err){
      lastError=err;
    }
  }

  try{
    const tempStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    tempStream.getTracks().forEach(t=>t.stop());
    await refreshVideoDevices();
    
    const backDev=allVideoDevices.find(d=>{
      const l=(d.label||"").toLowerCase();
      return l.includes("back")||l.includes("rear")||l.includes("environment")||l.includes("belakang")||l.includes("camera2 0")||l.includes("0, facing back");
    });
    if(backDev&&backDev.deviceId){
      return await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:backDev.deviceId}},audio:false});
    }
  }catch(err2){
    lastError=err2;
  }

  throw lastError||new Error("Kamera belakang tidak dapat diakses.");
}

async function startCamera(){
  if(!isSecureContext()){
    toast("Kamera butuh HTTPS. Buka via https:// atau localhost.");
    return;
  }
  if(!("mediaDevices" in navigator)||!navigator.mediaDevices.getUserMedia){
    toast("Browser tidak mendukung live video. Gunakan tombol 'Buka Kamera Foto HP'.");
    return;
  }

  updateCamToggleBtnText();

  try{
    if(e.startCamera) e.startCamera.textContent="Membuka kamera…";
    stream=await getCameraStream(currentFacingMode);

    e.camera.setAttribute("playsinline","true");
    e.camera.setAttribute("webkit-playsinline","true");
    e.camera.muted=true;
    e.camera.srcObject=stream;

    try{
      await e.camera.play();
    }catch(_){}

    try{
      const track=stream.getVideoTracks()[0];
      if(track&&typeof track.getCapabilities==="function"){
        const caps=track.getCapabilities();
        if(caps.focusMode&&Array.isArray(caps.focusMode)&&caps.focusMode.includes("continuous")){
          await track.applyConstraints({advanced:[{focusMode:"continuous"}]}).catch(()=>{});
        }
      }
    }catch(_){}

    e.cameraEmpty.classList.add("hidden");
    e.startCamera.classList.add("hidden");
    if(e.startCamera) e.startCamera.textContent="Aktifkan kamera";
    e.capture.disabled=false;
  }catch(err){
    console.error("Camera start error:",err);
    const errMsg=err?.name==="NotAllowedError"?"Izin kamera ditolak di browser HP.":
                 err?.name==="NotReadableError"?"Kamera sedang dipakai aplikasi lain.":
                 "Live scanner kamera tidak aktif. Gunakan tombol 'Buka Kamera Foto HP'.";
    toast(errMsg);
    if(e.startCamera) e.startCamera.textContent="Coba lagi";
  }
}

const canvasBlob=(c,q=.78)=>new Promise(r=>c.toBlob(r,"image/jpeg",q));

function openManual(mode="default"){
  e.manualAmount.value=amount?rupiah(amount):"";
  if(e.manualTime && e.displayTime)e.manualTime.value=e.displayTime.value||originalTime;
  if(e.manualDate && e.displayDate)e.manualDate.value=e.displayDate.value||originalDate||localDate();
  
  if(e.dateTimeFieldGroup){
    const isInstantCam=(mode==="camera"||mode==="native_camera")&&(inputSource==="camera"||inputSource==="native_camera");
    e.dateTimeFieldGroup.style.display=isInstantCam?"none":"";
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
  const todayD=localDate();
  originalTime=nowT;
  originalDate=todayD;

  if(e.displayTime)e.displayTime.value=nowT;
  if(e.manualTime)e.manualTime.value=nowT;
  if(e.displayDate)e.displayDate.value=todayD;
  if(e.manualDate)e.manualDate.value=todayD;

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

    const selectedDate=e.displayDate?.value||e.manualDate?.value;
    if(selectedDate){
      fd.append("customDate",selectedDate);
    }

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

    currentRole=data.role||"kasir";
    applySettingsUI(loadSettings());

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
if(e.settingsBtn)e.settingsBtn.onclick=openSettingsModal;
if(e.saveSettingsBtn)e.saveSettingsBtn.onclick=saveSettings;
if(e.settingShortcutEnabled){
  e.settingShortcutEnabled.onchange=()=>{
    if(e.shortcutFields)e.shortcutFields.style.display=e.settingShortcutEnabled.checked?"flex":"none";
  };
}

if(e.cleanNowBtn){
  e.cleanNowBtn.onclick=async()=>{
    if(!confirm("Yakin ingin membersihkan catatan & foto lama di R2 yang sudah melewati batas kadaluarsa?")) return;
    e.cleanNowBtn.disabled=true;
    e.cleanNowBtn.innerHTML=`<span>Sedang membersihkan…</span>`;
    try{
      const res=await fetch("/api/cleanup",{method:"POST"});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Gagal membersihkan data");
      toast(`Pembersihan sukses: ${data.deletedRecords||0} catatan & ${data.deletedImages||0} foto lama dibersihkan.`);
    }catch(err){
      toast(err.message||"Gagal melakukan pembersihan");
    }finally{
      e.cleanNowBtn.disabled=false;
      e.cleanNowBtn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg><span>Bersihkan Data Kadaluarsa Sekarang</span>`;
    }
  };
}

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

if(e.displayDate){
  e.displayDate.onchange=()=>{
    if(e.manualDate)e.manualDate.value=e.displayDate.value;
  };
}

if(e.nativeCamInput){
  e.nativeCamInput.onchange=()=>{
    const f=e.nativeCamInput.files[0];
    if(!f)return;
    const img=new Image();
    img.onload=()=>{useSource(img,"native_camera");URL.revokeObjectURL(img.src);};
    img.src=URL.createObjectURL(f);
    e.nativeCamInput.value="";
  };
}

if(e.fileInput){
  e.fileInput.onchange=()=>{
    const f=e.fileInput.files[0];
    if(!f)return;
    const img=new Image();
    img.onload=()=>{useSource(img,"gallery");URL.revokeObjectURL(img.src);};
    img.src=URL.createObjectURL(f);
    e.fileInput.value="";
  };
}

e.manualAmount.oninput=()=>{const d=e.manualAmount.value.replace(/\D/g,"");e.manualAmount.value=d?rupiah(Number(d)):"";};

e.applyManual.onclick=x=>{
  x.preventDefault();
  const n=Number(e.manualAmount.value.replace(/\D/g,""));
  if(!n)return toast("Masukkan nominal yang benar");
  amount=n;
  e.amount.textContent=rupiah(n);
  if(e.manualTime && e.displayTime)e.displayTime.value=e.manualTime.value;
  if(e.manualDate && e.displayDate)e.displayDate.value=e.manualDate.value;
  e.manualDialog.close();
};

e.share.onclick=()=>shareText(e.shareText.textContent);
e.copy.onclick=async()=>{await navigator.clipboard.writeText(e.shareText.textContent);toast("Teks disalin");};
e.shareRecap.onclick=()=>shareText(recapText);
e.copyRecap.onclick=async()=>{await navigator.clipboard.writeText(recapText);toast("Rekap disalin");};

// Inisialisasi awal pengaturan & riwayat
applySettingsUI(loadSettings());
e.historyDate.value=localDate();
loadHistory(true);
