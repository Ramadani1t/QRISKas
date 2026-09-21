const $=id=>document.getElementById(id);
const ids=[
  "camera","cameraEmpty","startCamera","toggleCamMode","capture","nativeCamBtn","nativeCamInput","fileInput",
  "openCashoutBtn","openSurplusBtn","confirmSurplusBadge","confirmCashoutBadge","confirmRevisedBadge","confirmNoteDisplay",
  "result","preview","amount","save","manual","manualDialog","manualAmount","manualDate","manualTime",
  "dateTimeFieldGroup","manualSurplusGroup","manualIsSurplus","manualNoteWrap","manualNote",
  "manualCashoutGroup","manualIsCashout","manualCashoutNoteWrap","manualCashoutNote",
  "manualRevisedGroup","manualIsRevised",
  "displayDate","displayTime","applyManual",
  "surplusDialog","surplusAmount","surplusNote","surplusGalleryBtn","surplusGalleryText",
  "surplusFileInput","surplusPreviewWrap","surplusPreviewImg","removeSurplusPhoto","surplusAutoProofNote",
  "surplusDate","surplusTime","saveSurplusBtn",
  "cashoutDialog","cashoutAmount","cashoutNote","cashoutGalleryBtn","cashoutGalleryText",
  "cashoutFileInput","cashoutPreviewWrap","cashoutPreviewImg","removeCashoutPhoto","cashoutAutoProofNote",
  "cashoutDate","cashoutTime","cashoutIsRevised","saveCashoutBtn",
  "rescan","canvas","success","shareText","share","copy","again","toast",
  "scanTab","historyTab","scanPage","historyPage","historyDate","historyLoading",
  "historyEmpty","historyList","recapBox","recapSalesRow","recapSalesTotal","recapSurplusRow","recapSurplusTotal","recapCashoutRow","recapCashoutTotal","recapRevisedRow","recapRevisedCount","recapDivider","historyTotal","shareRecap","copyRecap",
  "groupedTransactions","groupedList","groupedSummaryBadge","groupedCopyBtn",
  "editDialog","editAmount","editDate","editTime","editIsSurplus","editNoteWrap","editNote","editIsCashout","editIsRevised","editPinInput","saveEditBtn",
  "deleteDialog","deleteConfirmInfo","deletePinInput","deletePasswordInput","confirmDeleteBtn",
  "externalShortcut","settingsBtn","settingsDialog","settingDefaultCam","settingNativeCamMode","customPackageFields",
  "settingCustomPackage","settingShortcutEnabled","settingShortcutLabel","settingShortcutUrl","shortcutFields",
  "settingSurplusEnabled","settingCashoutEnabled","settingRevisionEnabled","settingGroupedEnabled","settingRetentionDays","cleanNowBtn","saveSettingsBtn"
];
const e=Object.fromEntries(ids.map(id=>[id,$(id)]));
let stream,imageBlob,amount=0,recapText="",originalTime="",originalDate="",pendingDeleteRecord=null,pendingEditRecord=null;
let inputSource="camera";
let currentFacingMode=localStorage.getItem("preferredFacingMode")||"environment";
let allVideoDevices=[];
let currentDeviceIndex=0;
let currentRole="kasir";
let isSurplusMode=false,isCashoutMode=false,isRevisedMode=false,currentNote="",surplusSelectedBlob=null,cashoutSelectedBlob=null;

const rupiah=n=>new Intl.NumberFormat("id-ID").format(n);
const escapeHtml=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const formatReceiptLine=(time,amt,isSurplus,isCashout,isRevised,note)=>{
  const tags=[];
  if(isSurplus){
    tags.push(note?`Surplus: ${note}`:"Surplus");
  }else if(isCashout){
    tags.push(note?`Tukar Cash: ${note}`:"Tukar Cash");
  }else if(note){
    tags.push(note);
  }
  if(isRevised){
    tags.push("Revisi");
  }
  const tagStr=tags.length?` (${tags.join(", ")})`:"";
  return `${time} - ${rupiah(amt)}${tagStr}`;
};
const toast=t=>{e.toast.textContent=t;e.toast.classList.add("show");setTimeout(()=>e.toast.classList.remove("show"),2800)};
const localDate=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`};
const currentJakartaTime=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.hour}:${v.minute}`};

// Cek apakah context aman (HTTPS atau localhost)
const isSecureContext=()=>location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"||location.hostname.endsWith(".local");

function loadSettings(){
  const facing=localStorage.getItem("preferredFacingMode")||"environment";
  const nativeCamMode=localStorage.getItem("nativeCamMode")||"direct";
  const customPackage=localStorage.getItem("customCameraPackage")||"org.lineageos.aperture";
  const shortcutEnabled=localStorage.getItem("shortcutEnabled")!=="false";
  const shortcutLabel=localStorage.getItem("shortcutLabel")||"Web Utama";
  const shortcutUrl=localStorage.getItem("shortcutUrl")||"https://tahunyakrispiya.my.id";
  const groupedEnabled=localStorage.getItem("groupedEnabled")!=="false";
  const surplusEnabled=localStorage.getItem("surplusEnabled")!=="false";
  const cashoutEnabled=localStorage.getItem("cashoutEnabled")!=="false";
  const revisionEnabled=localStorage.getItem("revisionEnabled")!=="false";
  return {facing,nativeCamMode,customPackage,shortcutEnabled,shortcutLabel,shortcutUrl,groupedEnabled,surplusEnabled,cashoutEnabled,revisionEnabled};
}

function applySettingsUI(s){
  currentFacingMode=s.facing;
  updateCamToggleBtnText();

  // Pengaturan mode buka kamera HP (nativeCamInput)
  if(e.nativeCamInput){
    if(s.nativeCamMode==="chooser"){
      e.nativeCamInput.removeAttribute("capture");
    }else{
      e.nativeCamInput.setAttribute("capture","environment");
    }
  }

  // Jika mode intip (guest), sembunyikan pengaturan dan web utama secara mutlak
  if(currentRole==="guest"){
    if(e.settingsBtn) e.settingsBtn.style.display="none";
    if(e.externalShortcut) e.externalShortcut.style.display="none";
    if(e.openSurplusBtn) e.openSurplusBtn.style.display="none";
    if(e.openCashoutBtn) e.openCashoutBtn.style.display="none";
    if(e.manualSurplusGroup) e.manualSurplusGroup.style.display="none";
    if(e.manualCashoutGroup) e.manualCashoutGroup.style.display="none";
    if(e.manualRevisedGroup) e.manualRevisedGroup.style.display="none";
    return;
  }

  if(e.openSurplusBtn){
    e.openSurplusBtn.style.display=s.surplusEnabled?"flex":"none";
  }
  if(e.manualSurplusGroup){
    e.manualSurplusGroup.style.display=s.surplusEnabled?"block":"none";
  }

  if(e.openCashoutBtn){
    e.openCashoutBtn.style.display=s.cashoutEnabled?"flex":"none";
  }
  if(e.manualCashoutGroup){
    e.manualCashoutGroup.style.display=s.cashoutEnabled?"block":"none";
  }

  if(e.manualRevisedGroup){
    e.manualRevisedGroup.style.display=s.revisionEnabled?"block":"none";
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
  if(e.settingNativeCamMode)e.settingNativeCamMode.value=s.nativeCamMode;
  if(e.customPackageFields)e.customPackageFields.style.display=s.nativeCamMode==="package"?"block":"none";
  if(e.settingCustomPackage)e.settingCustomPackage.value=s.customPackage;
  if(e.settingShortcutEnabled){
    e.settingShortcutEnabled.checked=s.shortcutEnabled;
    if(e.shortcutFields)e.shortcutFields.style.display=s.shortcutEnabled?"flex":"none";
  }
  if(e.settingShortcutLabel)e.settingShortcutLabel.value=s.shortcutLabel;
  if(e.settingShortcutUrl)e.settingShortcutUrl.value=s.shortcutUrl;
  if(e.settingSurplusEnabled)e.settingSurplusEnabled.checked=s.surplusEnabled;
  if(e.settingCashoutEnabled)e.settingCashoutEnabled.checked=s.cashoutEnabled;
  if(e.settingRevisionEnabled)e.settingRevisionEnabled.checked=s.revisionEnabled;
  if(e.settingGroupedEnabled)e.settingGroupedEnabled.checked=s.groupedEnabled;

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
  const nativeCamMode=e.settingNativeCamMode?.value||"direct";
  const customPackage=(e.settingCustomPackage?.value||"org.lineageos.aperture").trim()||"org.lineageos.aperture";
  const shortcutEnabled=e.settingShortcutEnabled?e.settingShortcutEnabled.checked:true;
  const shortcutLabel=(e.settingShortcutLabel?.value||"Web Utama").trim()||"Web Utama";
  let shortcutUrl=(e.settingShortcutUrl?.value||"").trim();
  if(!shortcutUrl)shortcutUrl="https://tahunyakrispiya.my.id";
  else if(!/^https?:\/\//i.test(shortcutUrl))shortcutUrl="https://"+shortcutUrl;

  const surplusEnabled=e.settingSurplusEnabled?e.settingSurplusEnabled.checked:true;
  const cashoutEnabled=e.settingCashoutEnabled?e.settingCashoutEnabled.checked:true;
  const revisionEnabled=e.settingRevisionEnabled?e.settingRevisionEnabled.checked:true;
  const groupedEnabled=e.settingGroupedEnabled?e.settingGroupedEnabled.checked:true;
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
  localStorage.setItem("nativeCamMode",nativeCamMode);
  localStorage.setItem("customCameraPackage",customPackage);
  localStorage.setItem("shortcutEnabled",String(shortcutEnabled));
  localStorage.setItem("shortcutLabel",shortcutLabel);
  localStorage.setItem("shortcutUrl",shortcutUrl);
  localStorage.setItem("surplusEnabled",String(surplusEnabled));
  localStorage.setItem("cashoutEnabled",String(cashoutEnabled));
  localStorage.setItem("revisionEnabled",String(revisionEnabled));
  localStorage.setItem("groupedEnabled",String(groupedEnabled));

  applySettingsUI({facing,nativeCamMode,customPackage,shortcutEnabled,shortcutLabel,shortcutUrl,groupedEnabled,surplusEnabled,cashoutEnabled,revisionEnabled});
  if(e.settingsDialog)e.settingsDialog.close();
  toast("Pengaturan disimpan");

  if(!e.historyPage.classList.contains("hidden")){
    loadHistory();
  }

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

async function getAllVideoInputDevices(){
  if(!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  try{
    const devices=await navigator.mediaDevices.enumerateDevices();
    allVideoDevices=devices.filter(d=>d.kind==="videoinput");
    return allVideoDevices;
  }catch(_){
    return [];
  }
}

async function toggleCamera(){
  const devices=await getAllVideoInputDevices();
  const hasLabels=devices.some(d=>(d.label||"").trim().length>0);
  if(devices.length>1 && hasLabels){
    currentDeviceIndex=(currentDeviceIndex+1)%devices.length;
    const dev=devices[currentDeviceIndex];
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
  return await getAllVideoInputDevices();
}

// Algoritma Multi-Tier Hardware Camera Stream (Sesuai Standar DStock POS)
async function getCameraStream(targetMode){
  if(stream){
    stream.getTracks().forEach(t=>{
      try{ t.stop(); }catch(_){}
    });
    stream=null;
  }
  if(e.camera && e.camera.srcObject){
    e.camera.srcObject=null;
  }
  await new Promise(r=>setTimeout(r,100));

  let devices=await getAllVideoInputDevices();
  const constraintsList=[];

  // HANYA filter by label jika label sudah terungkap (setelah izin kamera aktif)
  const hasLabels=devices.some(d=>(d.label||"").trim().length>0);
  if(devices.length>0 && hasLabels){
    if(targetMode==="environment"){
      const backDevs=devices.filter(d=>{
        const l=(d.label||"").toLowerCase();
        return l.includes("back")||l.includes("rear")||l.includes("environment")||
               l.includes("belakang")||l.includes("camera2 0")||l.includes("0, facing back")||
               l.includes("main")||(!l.includes("front")&&!l.includes("user")&&!l.includes("depan")&&!l.includes("selfie")&&!l.includes("1"));
      });
      for(const b of backDevs){
        if(b.deviceId) constraintsList.push({video:{deviceId:{exact:b.deviceId}},audio:false});
      }
    }else{
      const frontDevs=devices.filter(d=>{
        const l=(d.label||"").toLowerCase();
        return l.includes("front")||l.includes("user")||l.includes("depan")||l.includes("selfie")||l.includes("1, facing front");
      });
      for(const f of frontDevs){
        if(f.deviceId) constraintsList.push({video:{deviceId:{exact:f.deviceId}},audio:false});
      }
    }
  }

  // Fallback constraints bertingkat persis DStock
  if(targetMode==="environment"){
    constraintsList.push({video:{facingMode:{exact:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
    constraintsList.push({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}},audio:false});
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
      await getAllVideoInputDevices();
      return s;
    }catch(err){
      lastError=err;
    }
  }

  // Fallback tahap 3 persis DStock: streaming sementara untuk memicu dialog izin, lalu enumerasi deviceId kamera belakang
  try{
    const tempStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    tempStream.getTracks().forEach(t=>t.stop());
    devices=await getAllVideoInputDevices();
    const backDev=devices.find(d=>{
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

function triggerNativeCamera(){
  if(window.AndroidBridge && typeof window.AndroidBridge.openHardwareCamera==="function"){
    window.AndroidBridge.openHardwareCamera();
    return true;
  }
  if(window.QriskasAndroid && typeof window.QriskasAndroid.openHardwareCamera==="function"){
    window.QriskasAndroid.openHardwareCamera();
    return true;
  }
  if(e.nativeCamInput){
    e.nativeCamInput.click();
    return true;
  }
  return false;
}

async function startCamera(){
  if(!isSecureContext()){
    toast("Kamera butuh HTTPS. Buka via https:// atau localhost.");
    return;
  }
  if(!("mediaDevices" in navigator)||!navigator.mediaDevices.getUserMedia){
    triggerNativeCamera();
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
    console.warn("Live in-app camera error, falling back to hardware native camera:", err);
    e.cameraEmpty.classList.remove("hidden");
    e.startCamera.classList.remove("hidden");
    if(e.startCamera) e.startCamera.textContent="Coba lagi";
    
    // Auto-fallback persis DStock jika berjalan di Android App
    if(window.QriskasAndroid || window.AndroidBridge || window.__isAndroidApp){
      toast("Live kamera tidak aktif, beralih ke Kamera HP...");
      triggerNativeCamera();
    } else {
      const errMsg=err?.name==="NotAllowedError"?"Izin kamera ditolak di browser HP.":
                   err?.name==="NotReadableError"?"Kamera sedang dipakai aplikasi lain.":
                   "Live scanner kamera tidak aktif. Gunakan tombol 'Buka Kamera Foto HP'.";
      toast(errMsg);
    }
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

  if(e.manualIsSurplus){
    e.manualIsSurplus.checked=Boolean(isSurplusMode);
    if(e.manualNoteWrap)e.manualNoteWrap.style.display=isSurplusMode?"block":"none";
    if(e.manualNote)e.manualNote.value=isSurplusMode?currentNote:"";
  }

  if(e.manualIsCashout){
    e.manualIsCashout.checked=Boolean(isCashoutMode);
    if(e.manualCashoutNoteWrap)e.manualCashoutNoteWrap.style.display=isCashoutMode?"block":"none";
    if(e.manualCashoutNote)e.manualCashoutNote.value=isCashoutMode?currentNote:"";
  }

  if(e.manualIsRevised){
    e.manualIsRevised.checked=Boolean(isRevisedMode);
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
  
  // Update badge display berdasarkan state aktif
  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.toggle("hidden",!isSurplusMode);
  if(e.confirmCashoutBadge)e.confirmCashoutBadge.classList.toggle("hidden",!isCashoutMode);
  if(e.confirmRevisedBadge)e.confirmRevisedBadge.classList.toggle("hidden",!isRevisedMode);
  if(e.confirmNoteDisplay){
    if((isSurplusMode||isCashoutMode) && currentNote){
      e.confirmNoteDisplay.textContent=`Catatan: ${currentNote}`;
      e.confirmNoteDisplay.classList.remove("hidden");
    }else{
      e.confirmNoteDisplay.classList.add("hidden");
    }
  }
  
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

  const selectedDate=e.displayDate?.value||e.manualDate?.value||localDate();
  const selectedTime=e.displayTime?.value||e.manualTime?.value||currentJakartaTime();

  if(!navigator.onLine){
    await queueOfflineReceipt({
      amount: String(amount),
      isSurplus: Boolean(isSurplusMode),
      isCashout: Boolean(isCashoutMode),
      isRevised: Boolean(isRevisedMode),
      note: currentNote,
      customDate: selectedDate,
      customTime: selectedTime,
      imageBlob: imageBlob
    });
    const line=formatReceiptLine(selectedTime, amount, isSurplusMode, isCashoutMode, isRevisedMode, currentNote);
    e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Tersimpan di antrean offline! Akan otomatis disinkronkan saat ada internet.");
    e.save.disabled=false;
    e.save.textContent="Simpan";
    return;
  }

  try{
    const fd=new FormData();
    fd.append("image",imageBlob,"bukti-qris.jpg");
    fd.append("amount",String(amount));
    fd.append("isSurplus",String(Boolean(isSurplusMode)));
    fd.append("isCashout",String(Boolean(isCashoutMode)));
    fd.append("isRevised",String(Boolean(isRevisedMode)));
    if(currentNote) fd.append("note",currentNote);
    if(selectedDate) fd.append("customDate",selectedDate);
    if(selectedTime) fd.append("customTime",selectedTime);

    const response=await fetch("/api/receipts",{method:"POST",body:fd});
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.error);
    }

    const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(data.savedAt));
    const line=formatReceiptLine(time,data.amount,data.isSurplus,data.isCashout,data.isRevised,data.note);
    e.shareText.textContent=`${line} gambar ${data.imageUrl}`;
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
  }catch(x){
    if(!navigator.onLine || x.message?.includes("fetch") || x.message?.includes("NetworkError")){
      await queueOfflineReceipt({
        amount: String(amount),
        isSurplus: Boolean(isSurplusMode),
        isCashout: Boolean(isCashoutMode),
        isRevised: Boolean(isRevisedMode),
        note: currentNote,
        customDate: selectedDate,
        customTime: selectedTime,
        imageBlob: imageBlob
      });
      const line=formatReceiptLine(selectedTime, amount, isSurplusMode, isCashoutMode, isRevisedMode, currentNote);
      e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
      e.result.classList.add("hidden");
      e.success.classList.remove("hidden");
      e.success.scrollIntoView({behavior:"smooth"});
      toast("Tersimpan di antrean offline! Akan otomatis disinkronkan saat ada internet.");
    } else {
      toast(x.message||"Gagal menyimpan");
    }
  }
  finally{e.save.disabled=false;e.save.textContent="Simpan";}
}

function reset(){
  e.result.classList.add("hidden");
  e.success.classList.add("hidden");
  imageBlob=null;amount=0;
  isSurplusMode=false;isCashoutMode=false;isRevisedMode=false;currentNote="";
  surplusSelectedBlob=null;cashoutSelectedBlob=null;
  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.add("hidden");
  if(e.confirmCashoutBadge)e.confirmCashoutBadge.classList.add("hidden");
  if(e.confirmRevisedBadge)e.confirmRevisedBadge.classList.add("hidden");
  if(e.confirmNoteDisplay)e.confirmNoteDisplay.classList.add("hidden");
  if(e.manualIsSurplus)e.manualIsSurplus.checked=false;
  if(e.manualNoteWrap)e.manualNoteWrap.style.display="none";
  if(e.manualNote)e.manualNote.value="";
  if(e.manualIsCashout)e.manualIsCashout.checked=false;
  if(e.manualCashoutNoteWrap)e.manualCashoutNoteWrap.style.display="none";
  if(e.manualCashoutNote)e.manualCashoutNote.value="";
  if(e.manualIsRevised)e.manualIsRevised.checked=false;
  window.scrollTo({top:0,behavior:"smooth"});
}

async function generateSurplusProofImage(nominal,note,dateStr,timeStr){
  const c=document.createElement("canvas");
  c.width=800;c.height=600;
  const ctx=c.getContext("2d");
  const grad=ctx.createLinearGradient(0,0,800,600);
  grad.addColorStop(0,"#191506");
  grad.addColorStop(1,"#0a0903");
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,800,600);

  ctx.strokeStyle="#ffd000";
  ctx.lineWidth=6;
  ctx.strokeRect(16,16,768,568);

  ctx.strokeStyle="#342c10";
  ctx.lineWidth=2;
  ctx.strokeRect(26,26,748,548);

  ctx.fillStyle="#ffd000";
  ctx.font="bold 22px system-ui,sans-serif";
  ctx.textAlign="center";
  ctx.fillText("TAHUNYA KRISPIYA • QRIS KAS",400,75);

  ctx.fillStyle="rgba(56,189,248,0.15)";
  ctx.fillRect(230,95,340,36);
  ctx.strokeStyle="#38bdf8";
  ctx.lineWidth=1.5;
  ctx.strokeRect(230,95,340,36);

  ctx.fillStyle="#38bdf8";
  ctx.font="bold 15px system-ui,sans-serif";
  ctx.fillText("BUKTI CATATAN SURPLUS",400,119);

  ctx.fillStyle="#a89f82";
  ctx.font="14px system-ui,sans-serif";
  ctx.fillText("NOMINAL UANG SURPLUS / LEBIH",400,180);

  ctx.fillStyle="#ffffff";
  ctx.font="900 58px system-ui,sans-serif";
  ctx.fillText(`Rp${rupiah(nominal)}`,400,245);

  ctx.fillStyle="#110e05";
  ctx.fillRect(70,285,660,200);
  ctx.strokeStyle="#342c10";
  ctx.lineWidth=1.5;
  ctx.strokeRect(70,285,660,200);

  ctx.textAlign="left";
  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("WAKTU TRANSAKSI",100,325);
  ctx.fillStyle="#fffef5";
  ctx.font="16px system-ui,sans-serif";
  ctx.fillText(`${dateStr} • ${timeStr} WIB`,100,350);

  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("CATATAN / KETERANGAN KASIR",100,395);
  ctx.fillStyle="#ffd000";
  ctx.font="italic 16px system-ui,sans-serif";
  const noteText=note||"Tidak ada catatan khusus (Surplus Kasir)";
  ctx.fillText(noteText.length>55?noteText.slice(0,52)+"...":noteText,100,422);

  ctx.textAlign="center";
  ctx.fillStyle="#a89f82";
  ctx.font="12px system-ui,sans-serif";
  ctx.fillText("Tercatat Resmi di Sistem Kasir Digital • Cloudflare Serverless Storage",400,535);

  return await canvasBlob(c,0.85);
}

async function generateCashoutProofImage(nominal,note,dateStr,timeStr){
  const c=document.createElement("canvas");
  c.width=800;c.height=600;
  const ctx=c.getContext("2d");
  const grad=ctx.createLinearGradient(0,0,800,600);
  grad.addColorStop(0,"#1c1303");
  grad.addColorStop(1,"#0b0701");
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,800,600);

  ctx.strokeStyle="#fbbf24";
  ctx.lineWidth=6;
  ctx.strokeRect(16,16,768,568);

  ctx.strokeStyle="#4a3410";
  ctx.lineWidth=2;
  ctx.strokeRect(26,26,748,548);

  ctx.fillStyle="#ffd000";
  ctx.font="bold 22px system-ui,sans-serif";
  ctx.textAlign="center";
  ctx.fillText("TAHUNYA KRISPIYA • QRIS KAS",400,75);

  ctx.fillStyle="rgba(251,191,36,0.15)";
  ctx.fillRect(180,95,440,36);
  ctx.strokeStyle="#fbbf24";
  ctx.lineWidth=1.5;
  ctx.strokeRect(180,95,440,36);

  ctx.fillStyle="#fbbf24";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("BUKTI TUKAR QRIS KE CASH (POTONG LACI)",400,119);

  ctx.fillStyle="#a89f82";
  ctx.font="14px system-ui,sans-serif";
  ctx.fillText("NOMINAL UANG FISIK DITUKARKAN",400,180);

  ctx.fillStyle="#ffffff";
  ctx.font="900 58px system-ui,sans-serif";
  ctx.fillText(`Rp${rupiah(nominal)}`,400,245);

  ctx.fillStyle="#140d02";
  ctx.fillRect(70,285,660,200);
  ctx.strokeStyle="#4a3410";
  ctx.lineWidth=1.5;
  ctx.strokeRect(70,285,660,200);

  ctx.textAlign="left";
  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("WAKTU TRANSAKSI",100,325);
  ctx.fillStyle="#fffef5";
  ctx.font="16px system-ui,sans-serif";
  ctx.fillText(`${dateStr} • ${timeStr} WIB`,100,350);

  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("KETERANGAN KASIR",100,395);
  ctx.fillStyle="#fbbf24";
  ctx.font="italic 16px system-ui,sans-serif";
  const noteText=note||"Tukar QRIS ke Uang Tunai (Potong Kas Laci Kasir)";
  ctx.fillText(noteText.length>55?noteText.slice(0,52)+"...":noteText,100,422);

  ctx.textAlign="center";
  ctx.fillStyle="#a89f82";
  ctx.font="12px system-ui,sans-serif";
  ctx.fillText("Tercatat Resmi di Sistem Kasir Digital • Tidak Dihitung Sebagai Omset Penjualan",400,535);

  return await canvasBlob(c,0.85);
}

function openSurplusModal(){
  if(e.surplusAmount)e.surplusAmount.value="";
  if(e.surplusNote)e.surplusNote.value="";
  if(e.surplusDate)e.surplusDate.value=localDate();
  if(e.surplusTime)e.surplusTime.value=currentJakartaTime();
  surplusSelectedBlob=null;
  if(e.surplusPreviewWrap)e.surplusPreviewWrap.classList.add("hidden");
  if(e.surplusPreviewImg)e.surplusPreviewImg.src="";
  if(e.surplusGalleryText)e.surplusGalleryText.textContent="Pilih Foto Bukti dari Galeri";
  if(e.surplusFileInput)e.surplusFileInput.value="";
  if(e.surplusDialog){
    e.surplusDialog.showModal();
    setTimeout(()=>e.surplusAmount?.focus(),100);
  }
}

function openCashoutModal(){
  if(e.cashoutAmount)e.cashoutAmount.value="";
  if(e.cashoutNote)e.cashoutNote.value="";
  if(e.cashoutDate)e.cashoutDate.value=localDate();
  if(e.cashoutTime)e.cashoutTime.value=currentJakartaTime();
  if(e.cashoutIsRevised)e.cashoutIsRevised.checked=false;
  cashoutSelectedBlob=null;
  if(e.cashoutPreviewWrap)e.cashoutPreviewWrap.classList.add("hidden");
  if(e.cashoutPreviewImg)e.cashoutPreviewImg.src="";
  if(e.cashoutGalleryText)e.cashoutGalleryText.textContent="Pilih Foto Bukti dari Galeri";
  if(e.cashoutFileInput)e.cashoutFileInput.value="";
  if(e.cashoutDialog){
    e.cashoutDialog.showModal();
    setTimeout(()=>e.cashoutAmount?.focus(),100);
  }
}

async function saveSurplus(ev){
  ev.preventDefault();
  const sAmount=Number(e.surplusAmount.value.replace(/\D/g,""));
  if(!sAmount)return toast("Masukkan nominal surplus yang benar");

  const sNote=(e.surplusNote.value||"").trim();
  const sDate=e.surplusDate.value||localDate();
  const sTime=e.surplusTime.value||currentJakartaTime();

  if(e.saveSurplusBtn){
    e.saveSurplusBtn.disabled=true;
    e.saveSurplusBtn.textContent="Menyimpan…";
  }

  // Jika sedang offline
  if(!navigator.onLine){
    let finalBlob=surplusSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateSurplusProofImage(sAmount,sNote,sDate,sTime);
    }
    await queueOfflineReceipt({
      amount: String(sAmount),
      isSurplus: true,
      isCashout: false,
      isRevised: false,
      note: sNote,
      customDate: sDate,
      customTime: sTime,
      imageBlob: finalBlob
    });
    const line=formatReceiptLine(sTime,sAmount,true,false,false,sNote);
    e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
    if(e.surplusDialog)e.surplusDialog.close();
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Surplus tersimpan di antrean offline!");
    if(e.saveSurplusBtn){
      e.saveSurplusBtn.disabled=false;
      e.saveSurplusBtn.textContent="Simpan Surplus";
    }
    return;
  }

  try{
    let finalBlob=surplusSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateSurplusProofImage(sAmount,sNote,sDate,sTime);
    }

    const fd=new FormData();
    fd.append("image",finalBlob,"bukti-surplus.jpg");
    fd.append("amount",String(sAmount));
    fd.append("customDate",sDate);
    fd.append("customTime",sTime);
    fd.append("isSurplus","true");
    fd.append("isCashout","false");
    fd.append("isRevised","false");
    if(sNote)fd.append("note",sNote);

    const response=await fetch("/api/receipts",{method:"POST",body:fd});
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.error);
    }

    const time=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Asia/Jakarta",
      hour:"2-digit",
      minute:"2-digit",
      hourCycle:"h23"
    }).format(new Date(data.savedAt));

    const line=formatReceiptLine(time,data.amount,true,false,false,data.note);
    e.shareText.textContent=`${line} gambar ${data.imageUrl}`;
    if(e.surplusDialog)e.surplusDialog.close();

    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Surplus berhasil dicatat!");
  }catch(err){
    if(!navigator.onLine || err.message?.includes("fetch") || err.message?.includes("NetworkError")){
      let finalBlob=surplusSelectedBlob;
      if(!finalBlob){
        finalBlob=await generateSurplusProofImage(sAmount,sNote,sDate,sTime);
      }
      await queueOfflineReceipt({
        amount: String(sAmount),
        isSurplus: true,
        isCashout: false,
        isRevised: false,
        note: sNote,
        customDate: sDate,
        customTime: sTime,
        imageBlob: finalBlob
      });
      const line=formatReceiptLine(sTime,sAmount,true,false,false,sNote);
      e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
      if(e.surplusDialog)e.surplusDialog.close();
      e.result.classList.add("hidden");
      e.success.classList.remove("hidden");
      e.success.scrollIntoView({behavior:"smooth"});
      toast("Surplus tersimpan di antrean offline!");
    } else {
      toast(err.message||"Gagal menyimpan surplus");
    }
  }finally{
    if(e.saveSurplusBtn){
      e.saveSurplusBtn.disabled=false;
      e.saveSurplusBtn.textContent="Simpan Surplus";
    }
  }
}

async function saveCashout(ev){
  ev.preventDefault();
  const cAmount=Number(e.cashoutAmount.value.replace(/\D/g,""));
  if(!cAmount)return toast("Masukkan nominal tukar cash yang benar");

  const cNote=(e.cashoutNote.value||"").trim();
  const cDate=e.cashoutDate.value||localDate();
  const cTime=e.cashoutTime.value||currentJakartaTime();
  const cRevised=e.cashoutIsRevised?e.cashoutIsRevised.checked:false;

  if(e.saveCashoutBtn){
    e.saveCashoutBtn.disabled=true;
    e.saveCashoutBtn.textContent="Menyimpan…";
  }

  // Jika sedang offline
  if(!navigator.onLine){
    let finalBlob=cashoutSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateCashoutProofImage(cAmount,cNote,cDate,cTime);
    }
    await queueOfflineReceipt({
      amount: String(cAmount),
      isSurplus: false,
      isCashout: true,
      isRevised: cRevised,
      note: cNote,
      customDate: cDate,
      customTime: cTime,
      imageBlob: finalBlob
    });
    const line=formatReceiptLine(cTime,cAmount,false,true,cRevised,cNote);
    e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
    if(e.cashoutDialog)e.cashoutDialog.close();
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Tukar cash tersimpan di antrean offline!");
    if(e.saveCashoutBtn){
      e.saveCashoutBtn.disabled=false;
      e.saveCashoutBtn.textContent="Simpan Tukar Cash";
    }
    return;
  }

  try{
    let finalBlob=cashoutSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateCashoutProofImage(cAmount,cNote,cDate,cTime);
    }

    const fd=new FormData();
    fd.append("image",finalBlob,"bukti-tukar-cash.jpg");
    fd.append("amount",String(cAmount));
    fd.append("customDate",cDate);
    fd.append("customTime",cTime);
    fd.append("isCashout","true");
    fd.append("isRevised",String(cRevised));
    if(cNote)fd.append("note",cNote);

    const response=await fetch("/api/receipts",{method:"POST",body:fd});
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.error);
    }

    const time=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Asia/Jakarta",
      hour:"2-digit",
      minute:"2-digit",
      hourCycle:"h23"
    }).format(new Date(data.savedAt));

    const line=formatReceiptLine(time,data.amount,false,true,data.isRevised,data.note);
    e.shareText.textContent=`${line} gambar ${data.imageUrl}`;
    if(e.cashoutDialog)e.cashoutDialog.close();

    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Tukar cash berhasil dicatat!");
  }catch(err){
    if(!navigator.onLine || err.message?.includes("fetch") || err.message?.includes("NetworkError")){
      let finalBlob=cashoutSelectedBlob;
      if(!finalBlob){
        finalBlob=await generateCashoutProofImage(cAmount,cNote,cDate,cTime);
      }
      await queueOfflineReceipt({
        amount: String(cAmount),
        isSurplus: false,
        isCashout: true,
        isRevised: cRevised,
        note: cNote,
        customDate: cDate,
        customTime: cTime,
        imageBlob: finalBlob
      });
      const line=formatReceiptLine(cTime,cAmount,false,true,cRevised,cNote);
      e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
      if(e.cashoutDialog)e.cashoutDialog.close();
      e.result.classList.add("hidden");
      e.success.classList.remove("hidden");
      e.success.scrollIntoView({behavior:"smooth"});
      toast("Tukar cash tersimpan di antrean offline!");
    } else {
      toast(err.message||"Gagal menyimpan tukar cash");
    }
  }finally{
    if(e.saveCashoutBtn){
      e.saveCashoutBtn.disabled=false;
      e.saveCashoutBtn.textContent="Simpan Tukar Cash";
    }
  }
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

function openEditRecord(record){
  pendingEditRecord=record;
  if(e.editAmount)e.editAmount.value=rupiah(record.amount);
  
  // Format tanggal & jam Jakarta dari savedAt
  let recDate="";
  if(record.savedAt){
    try{
      recDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(record.savedAt));
    }catch{
      recDate=record.savedAt.split("T")[0];
    }
  }
  if(!recDate) recDate=localDate();
  if(e.editDate) e.editDate.value=recDate;

  // Format jam menggunakan en-GB agar separator selalu ':' bukan '.'
  let time="";
  if(record.savedAt){
    try{
      time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(record.savedAt));
    }catch{
      time=currentJakartaTime();
    }
  }
  if(!time) time=currentJakartaTime();
  if(e.editTime) e.editTime.value=time;
  if(e.editIsSurplus)e.editIsSurplus.checked=Boolean(record.isSurplus);
  if(e.editIsCashout)e.editIsCashout.checked=Boolean(record.isCashout);
  if(e.editIsRevised)e.editIsRevised.checked=Boolean(record.isRevised);
  if(e.editNote)e.editNote.value=record.note||"";
  
  if(e.editPinInput)e.editPinInput.value=sessionStorage.getItem("deletePin")||"";
  if(e.editDialog)e.editDialog.showModal();
}

async function handleSaveEdit(ev){
  ev.preventDefault();
  if(!pendingEditRecord)return;
  const newAmount=Number(e.editAmount.value.replace(/\D/g,""));
  if(!newAmount)return toast("Nominal rupiah tidak valid");
  const newDate=(e.editDate?.value||"").trim();
  if(!newDate)return toast("Tanggal transaksi wajib diisi");
  const newTime=(e.editTime?.value||"").trim();
  if(!newTime)return toast("Jam transaksi wajib diisi");
  const newIsSurplus=e.editIsSurplus?e.editIsSurplus.checked:false;
  const newIsCashout=e.editIsCashout?e.editIsCashout.checked:false;
  const newIsRevised=e.editIsRevised?e.editIsRevised.checked:false;
  const newNote=(e.editNote?.value||"").trim();
  const pin=(e.editPinInput?.value||"").trim();
  if(!pin)return toast("PIN 6-digit wajib diisi");

  if(e.saveEditBtn){
    e.saveEditBtn.disabled=true;
    e.saveEditBtn.textContent="Menyimpan…";
  }

  try{
    const response=await fetch("/api/receipts",{
      method:"PUT",
      headers:{"content-type":"application/json","x-delete-pin":pin},
      body:JSON.stringify({
        recordKey:pendingEditRecord.recordKey,
        newAmount,newDate,newTime,
        newIsSurplus,newIsCashout,newIsRevised,
        newNote
      })
    });
    const data=await response.json();
    if(!response.ok){
      if(response.status===401)sessionStorage.removeItem("deletePin");
      throw new Error(data.error);
    }
    sessionStorage.setItem("deletePin",pin);
    if(e.editDialog)e.editDialog.close();
    toast("Transaksi berhasil diperbarui");
    pendingEditRecord=null;
    if(newDate && e.historyDate && e.historyDate.value!==newDate){
      e.historyDate.value=newDate;
    }
    await loadHistory();
  }catch(x){
    toast(x.message||"Gagal mengedit transaksi");
  }finally{
    if(e.saveEditBtn){
      e.saveEditBtn.disabled=false;
      e.saveEditBtn.textContent="Simpan Perubahan";
    }
  }
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

    if(!data.records.length){
      e.historyEmpty.classList.remove("hidden");
      if(e.groupedTransactions)e.groupedTransactions.classList.add("hidden");
      return;
    }

    // Hitung total dan kelompokkan transaksi dengan nominal yang sama
    const groupMap=new Map();
    let total=0, salesTotal=0, surplusTotal=0, cashoutTotal=0, revisedCount=0;
    const lines=[],links=[];
    for(const [index,r] of data.records.entries()){
      total+=r.amount;
      const isSurplus=Boolean(r.isSurplus);
      const isCashout=Boolean(r.isCashout);
      const isRevised=Boolean(r.isRevised);
      if(isSurplus){
        surplusTotal+=r.amount;
      }else if(isCashout){
        cashoutTotal+=r.amount;
      }else{
        salesTotal+=r.amount;
      }
      if(isRevised){
        revisedCount++;
      }

      const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(r.savedAt));
      const line=formatReceiptLine(time,r.amount,isSurplus,isCashout,isRevised,r.note);
      lines.push(`${index+1}. ${line}`);
      links.push(`${index+1}. ${r.imageUrl}`);

      if(!isSurplus && !isCashout){
        if(!groupMap.has(r.amount)){
          groupMap.set(r.amount,{amount:r.amount,count:0,total:0,times:[]});
        }
        const g=groupMap.get(r.amount);
        g.count++;
        g.total+=r.amount;
        g.times.push(time);
      }

      const item=document.createElement("article");
      item.className=`history-item${isSurplus?" is-surplus":""}${isCashout?" is-cashout":""}${isRevised?" is-revised":""}`;
      
      const surplusBadgeHtml=isSurplus?`<span class="badge-surplus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span>SURPLUS</span></span>`:"";
      const cashoutBadgeHtml=isCashout?`<span class="badge-cashout"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg><span>TUKAR CASH</span></span>`:"";
      const revisedBadgeHtml=isRevised?`<span class="badge-revised"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg><span>REVISI</span></span>`:"";

      const safeNote=escapeHtml(r.note);
      const noteHtml=r.note?`<div class="history-item-note" title="${safeNote}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>${safeNote}</span></div>`:"";
      const adminActionsHtml=data.role==="admin"?`<button class="edit-record" type="button" aria-label="Edit transaksi">Edit</button><button class="delete-record" type="button" aria-label="Hapus transaksi">Hapus</button>`:"";

      item.innerHTML=`<img class="history-item-thumb" src="${r.imageUrl}" alt="Bukti ${isSurplus?"Surplus":isCashout?"Tukar Cash":"QRIS"}" loading="lazy"><div class="history-item-body"><div class="history-item-header"><div class="history-item-meta"><time class="history-item-time">${time} WIB</time>${surplusBadgeHtml}${cashoutBadgeHtml}${revisedBadgeHtml}</div><div class="history-item-actions"><button class="copy-record" type="button" title="Salin transaksi ini">Salin</button>${adminActionsHtml}</div></div><strong class="history-item-amount">Rp${rupiah(r.amount)}</strong>${noteHtml}<a class="history-item-link" href="${r.imageUrl}" target="_blank" rel="noopener"><span>Lihat foto bukti</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>`;
      item.querySelector(".copy-record").onclick=async()=>{
        await navigator.clipboard.writeText(`${line} gambar ${r.imageUrl}`);
        toast("Transaksi disalin");
      };
      if(data.role==="admin"){
        item.querySelector(".edit-record").onclick=()=>openEditRecord(r);
        item.querySelector(".delete-record").onclick=()=>removeRecord(r);
      }
      e.historyList.append(item);
    }

    // Filter: "kalo beda mah gak usah ditampilin" -> HANYA yang count > 1
    const duplicateGroups=Array.from(groupMap.values())
      .filter(g=>g.count>1)
      .sort((a,b)=>b.total-a.total);

    const s=loadSettings();
    let groupedSummaryText="";
    if(s.groupedEnabled && duplicateGroups.length>0){
      if(e.groupedSummaryBadge)e.groupedSummaryBadge.textContent=`${duplicateGroups.length} nominal berulang`;
      if(e.groupedList){
        e.groupedList.innerHTML=duplicateGroups.map(g=>`
          <div class="grouped-item">
            <div class="grouped-item-left">
              <div class="grouped-qty">${g.count}<small>×</small></div>
              <div class="grouped-info">
                <strong class="grouped-amount">Rp${rupiah(g.amount)}</strong>
                <span class="grouped-times">Jam: ${g.times.join(", ")}</span>
              </div>
            </div>
            <div class="grouped-item-right">
              <span class="grouped-total-label">Subtotal</span>
              <strong class="grouped-total-amount">Rp${rupiah(g.total)}</strong>
            </div>
          </div>
        `).join("");
      }
      if(e.groupedTransactions)e.groupedTransactions.classList.remove("hidden");

      groupedSummaryText=`\n\n*Pengelompokan Nominal Sama:*\n`+duplicateGroups.map(g=>`• ${g.count}x Rp${rupiah(g.amount)} = Rp${rupiah(g.total)} (Jam: ${g.times.join(", ")})`).join("\n");
    }else{
      if(e.groupedTransactions)e.groupedTransactions.classList.add("hidden");
    }

    if(e.groupedCopyBtn){
      e.groupedCopyBtn.onclick=async()=>{
        if(!duplicateGroups.length)return;
        const text=`*Pengelompokan Transaksi Sama (${titleDate(date)})*\n`+duplicateGroups.map(g=>`• ${g.count}x Rp${rupiah(g.amount)} = Rp${rupiah(g.total)} (Jam: ${g.times.join(", ")})`).join("\n");
        await navigator.clipboard.writeText(text);
        toast("Pengelompokan nominal disalin");
      };
    }

    const recapBreakdown=[];
    recapBreakdown.push(`*Total Penjualan: Rp${rupiah(salesTotal)}*`);
    if(cashoutTotal>0){
      recapBreakdown.push(`*Tukar Cash (Potong Laci): -Rp${rupiah(cashoutTotal)}*`);
    }
    if(surplusTotal>0){
      recapBreakdown.push(`*Total Surplus: +Rp${rupiah(surplusTotal)}*`);
    }
    recapBreakdown.push(`*Grand Total QRIS Bank: Rp${rupiah(total)}*`);
    if(revisedCount>0){
      recapBreakdown.push(`*Catatan: ${revisedCount} transaksi berlabel Revisi/Susulan*`);
    }

    recapText=`*REKAP TRANSAKSI QRIS (${titleDate(date)})*\n\n${lines.join("\n")}${groupedSummaryText}\n\n${recapBreakdown.join("\n")}\n\nLink bukti:\n${links.join("\n")}`;
    if(e.recapSalesTotal)e.recapSalesTotal.textContent=`Rp${rupiah(salesTotal)}`;
    if(e.recapSurplusTotal)e.recapSurplusTotal.textContent=`+Rp${rupiah(surplusTotal)}`;
    if(e.recapCashoutTotal)e.recapCashoutTotal.textContent=`-Rp${rupiah(cashoutTotal)}`;
    if(e.recapRevisedCount)e.recapRevisedCount.textContent=`${revisedCount} trx`;
    if(e.historyTotal)e.historyTotal.textContent=`Rp${rupiah(total)}`;

    const hasSpecialRows=surplusTotal>0||cashoutTotal>0||revisedCount>0;
    if(e.recapSurplusRow)e.recapSurplusRow.style.display=surplusTotal>0?"flex":"none";
    if(e.recapCashoutRow)e.recapCashoutRow.style.display=cashoutTotal>0?"flex":"none";
    if(e.recapRevisedRow)e.recapRevisedRow.style.display=revisedCount>0?"flex":"none";
    if(e.recapDivider)e.recapDivider.style.display=hasSpecialRows?"block":"none";

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

if(e.settingNativeCamMode){
  e.settingNativeCamMode.onchange=()=>{
    if(e.customPackageFields){
      e.customPackageFields.style.display=e.settingNativeCamMode.value==="package"?"block":"none";
    }
  };
}

if(e.nativeCamBtn){
  e.nativeCamBtn.addEventListener("click",(evt)=>{
    const s=loadSettings();
    if(s.nativeCamMode==="package"){
      evt.preventDefault();
      evt.stopPropagation();
      const pkg=s.customPackage||"org.lineageos.aperture";
      toast(`Membuka kamera ${pkg}…`);
      
      const intentUrl=`intent:#Intent;action=android.media.action.STILL_IMAGE_CAMERA;package=${pkg};end`;
      window.location.href=intentUrl;

      const handleReturn=()=>{
        window.removeEventListener("focus", handleReturn);
        document.removeEventListener("visibilitychange", handleVis);
        setTimeout(()=>{
          if(confirm("Foto bukti sudah dijepret di kamera?\n\nTekan OK untuk memilih foto hasil jepretan dari galeri.")){
            if(e.fileInput) e.fileInput.click();
          }
        }, 500);
      };
      const handleVis=()=>{
        if(document.visibilityState==="visible"){
          handleReturn();
        }
      };
      window.addEventListener("focus", handleReturn, {once: true});
      document.addEventListener("visibilitychange", handleVis, {once: true});
      return;
    }

    // Direct / Hardware mode di Android App (persis DStock)
    if(window.QriskasAndroid || window.AndroidBridge || window.__isAndroidApp){
      evt.preventDefault();
      evt.stopPropagation();
      triggerNativeCamera();
    }
  });
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

  if(e.manualIsSurplus && e.manualIsSurplus.checked){
    isSurplusMode=true;
    isCashoutMode=false;
    currentNote=(e.manualNote?.value||"").trim();
  } else if(e.manualIsCashout && e.manualIsCashout.checked){
    isCashoutMode=true;
    isSurplusMode=false;
    currentNote=(e.manualCashoutNote?.value||"").trim();
  } else {
    isSurplusMode=false;
    isCashoutMode=false;
    currentNote="";
  }

  if(e.manualIsRevised){
    isRevisedMode=e.manualIsRevised.checked;
  }

  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.toggle("hidden",!isSurplusMode);
  if(e.confirmCashoutBadge)e.confirmCashoutBadge.classList.toggle("hidden",!isCashoutMode);
  if(e.confirmRevisedBadge)e.confirmRevisedBadge.classList.toggle("hidden",!isRevisedMode);

  if(e.confirmNoteDisplay){
    if((isSurplusMode||isCashoutMode) && currentNote){
      e.confirmNoteDisplay.textContent=`Catatan: ${currentNote}`;
      e.confirmNoteDisplay.classList.remove("hidden");
    }else{
      e.confirmNoteDisplay.classList.add("hidden");
    }
  }

  e.manualDialog.close();
};

if(e.manualIsSurplus){
  e.manualIsSurplus.onchange=()=>{
    if(e.manualIsSurplus.checked){
      if(e.manualIsCashout){
        e.manualIsCashout.checked=false;
        if(e.manualCashoutNoteWrap)e.manualCashoutNoteWrap.style.display="none";
      }
      if(e.manualNoteWrap){
        e.manualNoteWrap.style.display="block";
        if(e.manualNote)setTimeout(()=>e.manualNote.focus(),100);
      }
    }else{
      if(e.manualNoteWrap)e.manualNoteWrap.style.display="none";
    }
  };
}

if(e.manualIsCashout){
  e.manualIsCashout.onchange=()=>{
    if(e.manualIsCashout.checked){
      if(e.manualIsSurplus){
        e.manualIsSurplus.checked=false;
        if(e.manualNoteWrap)e.manualNoteWrap.style.display="none";
      }
      if(e.manualCashoutNoteWrap){
        e.manualCashoutNoteWrap.style.display="block";
        if(e.manualCashoutNote)setTimeout(()=>e.manualCashoutNote.focus(),100);
      }
    }else{
      if(e.manualCashoutNoteWrap)e.manualCashoutNoteWrap.style.display="none";
    }
  };
}

if(e.editIsSurplus){
  e.editIsSurplus.onchange=()=>{
    if(e.editIsSurplus.checked && e.editIsCashout){
      e.editIsCashout.checked=false;
    }
  };
}

if(e.editIsCashout){
  e.editIsCashout.onchange=()=>{
    if(e.editIsCashout.checked && e.editIsSurplus){
      e.editIsSurplus.checked=false;
    }
  };
}

if(e.openSurplusBtn) e.openSurplusBtn.onclick=openSurplusModal;
if(e.saveSurplusBtn) e.saveSurplusBtn.onclick=saveSurplus;

if(e.surplusAmount){
  e.surplusAmount.oninput=()=>{
    const d=e.surplusAmount.value.replace(/\D/g,"");
    e.surplusAmount.value=d?rupiah(Number(d)):"";
  };
}

if(e.surplusFileInput){
  e.surplusFileInput.onchange=()=>{
    const f=e.surplusFileInput.files[0];
    if(!f)return;
    const img=new Image();
    img.onload=async()=>{
      const w=img.naturalWidth,h=img.naturalHeight,max=1100,z=Math.min(1,max/w);
      e.canvas.width=Math.round(w*z);
      e.canvas.height=Math.round(h*z);
      e.canvas.getContext("2d").drawImage(img,0,0,e.canvas.width,e.canvas.height);
      surplusSelectedBlob=await canvasBlob(e.canvas);
      if(e.surplusPreviewImg)e.surplusPreviewImg.src=URL.createObjectURL(surplusSelectedBlob);
      if(e.surplusPreviewWrap)e.surplusPreviewWrap.classList.remove("hidden");
      if(e.surplusGalleryText)e.surplusGalleryText.textContent="Ganti Foto Bukti Galeri";
      URL.revokeObjectURL(img.src);
    };
    img.src=URL.createObjectURL(f);
  };
}

if(e.removeSurplusPhoto){
  e.removeSurplusPhoto.onclick=()=>{
    surplusSelectedBlob=null;
    if(e.surplusPreviewWrap)e.surplusPreviewWrap.classList.add("hidden");
    if(e.surplusPreviewImg)e.surplusPreviewImg.src="";
    if(e.surplusGalleryText)e.surplusGalleryText.textContent="Pilih Foto Bukti dari Galeri";
    if(e.surplusFileInput)e.surplusFileInput.value="";
  };
}

if(e.openCashoutBtn) e.openCashoutBtn.onclick=openCashoutModal;
if(e.saveCashoutBtn) e.saveCashoutBtn.onclick=saveCashout;

if(e.cashoutAmount){
  e.cashoutAmount.oninput=()=>{
    const d=e.cashoutAmount.value.replace(/\D/g,"");
    e.cashoutAmount.value=d?rupiah(Number(d)):"";
  };
}

if(e.cashoutFileInput){
  e.cashoutFileInput.onchange=()=>{
    const f=e.cashoutFileInput.files[0];
    if(!f)return;
    const img=new Image();
    img.onload=async()=>{
      const w=img.naturalWidth,h=img.naturalHeight,max=1100,z=Math.min(1,max/w);
      e.canvas.width=Math.round(w*z);
      e.canvas.height=Math.round(h*z);
      e.canvas.getContext("2d").drawImage(img,0,0,e.canvas.width,e.canvas.height);
      cashoutSelectedBlob=await canvasBlob(e.canvas);
      if(e.cashoutPreviewImg)e.cashoutPreviewImg.src=URL.createObjectURL(cashoutSelectedBlob);
      if(e.cashoutPreviewWrap)e.cashoutPreviewWrap.classList.remove("hidden");
      if(e.cashoutGalleryText)e.cashoutGalleryText.textContent="Ganti Foto Bukti Galeri";
      URL.revokeObjectURL(img.src);
    };
    img.src=URL.createObjectURL(f);
  };
}

if(e.removeCashoutPhoto){
  e.removeCashoutPhoto.onclick=()=>{
    cashoutSelectedBlob=null;
    if(e.cashoutPreviewWrap)e.cashoutPreviewWrap.classList.add("hidden");
    if(e.cashoutPreviewImg)e.cashoutPreviewImg.src="";
    if(e.cashoutGalleryText)e.cashoutGalleryText.textContent="Pilih Foto Bukti dari Galeri";
    if(e.cashoutFileInput)e.cashoutFileInput.value="";
  };
}

e.share.onclick=()=>shareText(e.shareText.textContent);
e.copy.onclick=async()=>{await navigator.clipboard.writeText(e.shareText.textContent);toast("Teks disalin");};
e.shareRecap.onclick=()=>shareText(recapText);
e.copyRecap.onclick=async()=>{await navigator.clipboard.writeText(recapText);toast("Rekap disalin");};
if(e.editAmount){
  e.editAmount.oninput=()=>{const d=e.editAmount.value.replace(/\D/g,"");e.editAmount.value=d?rupiah(Number(d)):"";};
}
if(e.saveEditBtn) e.saveEditBtn.onclick=handleSaveEdit;

// Inisialisasi awal pengaturan & riwayat
applySettingsUI(loadSettings());
e.historyDate.value=localDate();
loadHistory(true);

// === NATIVE ANDROID HARDWARE CAMERA BRIDGE CALLBACK (Persis DStock) ===
window.onHardwareCameraCapture = function(dataUrl) {
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    useSource(img, "native_camera");
    toast("Foto kamera belakang berhasil dimuat!");
    if (window.QriskasAndroid && typeof window.QriskasAndroid.vibrate === "function") {
      window.QriskasAndroid.vibrate(50);
    } else if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === "function") {
      window.AndroidBridge.vibrate(50);
    }
  };
  img.src = dataUrl;
};
window._qriskasNativeCameraCallback = window.onHardwareCameraCapture;

// === OFFLINE-FIRST STORAGE & AUTO-SYNC ===
const OFFLINE_DB_NAME = "qriskas_offline_db";
const OFFLINE_STORE = "pending_receipts";

function openOfflineDb() {
  return new Promise((resolve) => {
    if (!window.indexedDB) return resolve(null);
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(OFFLINE_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function queueOfflineReceipt(item) {
  try {
    const db = await openOfflineDb();
    if (!db) {
      const list = JSON.parse(localStorage.getItem("qriskas_offline_queue") || "[]");
      list.push(item);
      localStorage.setItem("qriskas_offline_queue", JSON.stringify(list));
      return true;
    }
    return new Promise(resolve => {
      const tx = db.transaction(OFFLINE_STORE, "readwrite");
      tx.objectStore(OFFLINE_STORE).add(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (_) {
    return false;
  }
}

async function syncOfflineQueue() {
  if (!navigator.onLine) return;
  try {
    const db = await openOfflineDb();
    if (!db) return;
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = async () => {
      const items = req.result || [];
      if (!items.length) return;
      toast(`Menyinkronkan ${items.length} transaksi offline...`);
      for (const it of items) {
        try {
          const fd = new FormData();
          if (it.imageBlob) fd.append("image", it.imageBlob, "bukti-qris.jpg");
          fd.append("amount", String(it.amount));
          fd.append("isSurplus", String(Boolean(it.isSurplus)));
          fd.append("isCashout", String(Boolean(it.isCashout)));
          fd.append("isRevised", String(Boolean(it.isRevised)));
          if (it.note) fd.append("note", it.note);
          if (it.customDate) fd.append("customDate", it.customDate);
          if (it.customTime) fd.append("customTime", it.customTime);

          const res = await fetch("/api/receipts", { method: "POST", body: fd });
          if (res.ok) {
            const delTx = db.transaction(OFFLINE_STORE, "readwrite");
            delTx.objectStore(OFFLINE_STORE).delete(it.id);
          }
        } catch (_) {
          break;
        }
      }
      toast("Sinkronisasi transaksi offline selesai!");
      if (!e.historyPage.classList.contains("hidden")) {
        loadHistory();
      }
    };
  } catch (err) {
    console.warn("Offline sync error:", err);
  }
}

window.addEventListener("online", syncOfflineQueue);
window.addEventListener("qriskas:online", syncOfflineQueue);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => console.log("SW error:", err));
  });
}

