const $=id=>document.getElementById(id);
const ids=[
  "camera","cameraEmpty","startCamera","toggleCamMode","capture","nativeCamBtn","nativeCamInput","fileInput",
  "openSurplusBtn","confirmSurplusBadge","confirmNoteDisplay",
  "result","preview","amount","save","manual","manualDialog","manualAmount","manualDate","manualTime",
  "dateTimeFieldGroup","manualSurplusGroup","manualIsSurplus","manualNoteWrap","manualNote","displayDate","displayTime","applyManual",
  "surplusDialog","surplusAmount","surplusNote","surplusGalleryBtn","surplusGalleryText",
  "surplusFileInput","surplusPreviewWrap","surplusPreviewImg","removeSurplusPhoto","surplusAutoProofNote",
  "surplusDate","surplusTime","saveSurplusBtn",
  "rescan","canvas","success","shareText","share","copy","again","toast",
  "scanTab","historyTab","scanPage","historyPage","historyDate","historyLoading",
  "historyEmpty","historyList","recapBox","recapSalesRow","recapSalesTotal","recapSurplusRow","recapSurplusTotal","recapDivider","historyTotal","shareRecap","copyRecap",
  "groupedTransactions","groupedList","groupedSummaryBadge","groupedCopyBtn",
  "editDialog","editAmount","editDate","editTime","editIsSurplus","editNoteWrap","editNote","editPinInput","saveEditBtn",
  "deleteDialog","deleteConfirmInfo","deletePinInput","deletePasswordInput","confirmDeleteBtn",
  "externalShortcut","settingsBtn","settingsDialog","settingDefaultCam","settingNativeCamMode","customPackageFields",
  "settingCustomPackage","settingShortcutEnabled","settingShortcutLabel","settingShortcutUrl","shortcutFields",
  "settingSurplusEnabled","settingGroupedEnabled","settingRetentionDays","cleanNowBtn","saveSettingsBtn"
];
const e=Object.fromEntries(ids.map(id=>[id,$(id)]));
let stream,imageBlob,amount=0,recapText="",originalTime="",originalDate="",pendingDeleteRecord=null,pendingEditRecord=null;
let inputSource="camera";
let currentFacingMode=localStorage.getItem("preferredFacingMode")||"environment";
let allVideoDevices=[];
let currentDeviceIndex=0;
let currentRole="kasir";
let isSurplusMode=false,currentNote="",surplusSelectedBlob=null;

const rupiah=n=>new Intl.NumberFormat("id-ID").format(n);
const escapeHtml=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const formatReceiptLine=(time,amt,isSurplus,note)=>{
  let tag="";
  if(isSurplus&&note){
    tag=` (Surplus: ${note})`;
  }else if(isSurplus){
    tag=` (Surplus)`;
  }else if(note){
    tag=` (${note})`;
  }
  return `${time} - ${rupiah(amt)}${tag}`;
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
  return {facing,nativeCamMode,customPackage,shortcutEnabled,shortcutLabel,shortcutUrl,groupedEnabled,surplusEnabled};
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
    if(e.manualSurplusGroup) e.manualSurplusGroup.style.display="none";
    return;
  }

  if(e.openSurplusBtn){
    e.openSurplusBtn.style.display=s.surplusEnabled?"flex":"none";
  }
  if(e.manualSurplusGroup){
    e.manualSurplusGroup.style.display=s.surplusEnabled?"block":"none";
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
  localStorage.setItem("groupedEnabled",String(groupedEnabled));

  applySettingsUI({facing,nativeCamMode,customPackage,shortcutEnabled,shortcutLabel,shortcutUrl,groupedEnabled,surplusEnabled});
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

  if(e.manualIsSurplus){
    e.manualIsSurplus.checked=Boolean(isSurplusMode);
    if(e.manualNoteWrap)e.manualNoteWrap.style.display=isSurplusMode?"block":"none";
    if(e.manualNote)e.manualNote.value=currentNote||"";
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
  isSurplusMode=false;currentNote="";
  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.add("hidden");
  if(e.confirmNoteDisplay)e.confirmNoteDisplay.classList.add("hidden");
  
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
    fd.append("isSurplus",String(Boolean(isSurplusMode)));
    if(currentNote) fd.append("note",currentNote);

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

    const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(data.savedAt));
    const line=formatReceiptLine(time,data.amount,data.isSurplus,data.note);
    e.shareText.textContent=`${line} gambar ${data.imageUrl}`;
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
  isSurplusMode=false;currentNote="";
  surplusSelectedBlob=null;
  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.add("hidden");
  if(e.confirmNoteDisplay)e.confirmNoteDisplay.classList.add("hidden");
  if(e.manualIsSurplus)e.manualIsSurplus.checked=false;
  if(e.manualNoteWrap)e.manualNoteWrap.style.display="none";
  if(e.manualNote)e.manualNote.value="";
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
  ctx.fillText("✨ BUKTI CATATAN SURPLUS ✨",400,119);

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

    const line=formatReceiptLine(time,data.amount,true,data.note);
    e.shareText.textContent=`${line} gambar ${data.imageUrl}`;
    if(e.surplusDialog)e.surplusDialog.close();

    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Surplus berhasil dicatat!");
  }catch(err){
    toast(err.message||"Gagal menyimpan surplus");
  }finally{
    if(e.saveSurplusBtn){
      e.saveSurplusBtn.disabled=false;
      e.saveSurplusBtn.textContent="Simpan Surplus";
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
      body:JSON.stringify({recordKey:pendingEditRecord.recordKey,newAmount,newDate,newTime,newIsSurplus,newNote})
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
    let total=0, salesTotal=0, surplusTotal=0;
    const lines=[],links=[];
    for(const [index,r] of data.records.entries()){
      total+=r.amount;
      const isSurplus=Boolean(r.isSurplus);
      if(isSurplus){
        surplusTotal+=r.amount;
      }else{
        salesTotal+=r.amount;
      }

      const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(r.savedAt));
      const line=formatReceiptLine(time,r.amount,isSurplus,r.note);
      lines.push(`${index+1}. ${line}`);
      links.push(`${index+1}. ${r.imageUrl}`);

      if(!isSurplus){
        if(!groupMap.has(r.amount)){
          groupMap.set(r.amount,{amount:r.amount,count:0,total:0,times:[]});
        }
        const g=groupMap.get(r.amount);
        g.count++;
        g.total+=r.amount;
        g.times.push(time);
      }

      const item=document.createElement("article");
      item.className=`history-item${isSurplus?" is-surplus":""}`;
      const surplusBadgeHtml=isSurplus?`<span class="badge-surplus">✨ SURPLUS</span>`:"";
      const safeNote=escapeHtml(r.note);
      const noteHtml=r.note?`<div class="history-item-note" title="${safeNote}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>${safeNote}</span></div>`:"";
      const adminActionsHtml=data.role==="admin"?`<button class="edit-record" type="button" aria-label="Edit transaksi">Edit</button><button class="delete-record" type="button" aria-label="Hapus transaksi">Hapus</button>`:"";

      item.innerHTML=`<img class="history-item-thumb" src="${r.imageUrl}" alt="Bukti ${isSurplus?"Surplus":"QRIS"}" loading="lazy"><div class="history-item-body"><div class="history-item-header"><div class="history-item-meta"><time class="history-item-time">${time} WIB</time>${surplusBadgeHtml}</div><div class="history-item-actions"><button class="copy-record" type="button" title="Salin transaksi ini">Salin</button>${adminActionsHtml}</div></div><strong class="history-item-amount">Rp${rupiah(r.amount)}</strong>${noteHtml}<a class="history-item-link" href="${r.imageUrl}" target="_blank" rel="noopener"><span>Lihat foto bukti</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>`;
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

    let recapTotalsText=`*Total QRIS: ${rupiah(total)}*`;
    if(surplusTotal>0){
      recapTotalsText=`*Total Penjualan: ${rupiah(salesTotal)}*\n*Total Surplus: ${rupiah(surplusTotal)}*\n*Grand Total QRIS: ${rupiah(total)}*`;
    }

    recapText=`*REKAP TRANSAKSI QRIS (${titleDate(date)})*\n\n${lines.join("\n")}${groupedSummaryText}\n\n${recapTotalsText}\n\nLink bukti:\n${links.join("\n")}`;
    if(e.recapSalesTotal)e.recapSalesTotal.textContent=`Rp${rupiah(salesTotal)}`;
    if(e.recapSurplusTotal)e.recapSurplusTotal.textContent=`Rp${rupiah(surplusTotal)}`;
    if(e.historyTotal)e.historyTotal.textContent=`Rp${rupiah(total)}`;

    if(surplusTotal>0){
      if(e.recapSurplusRow)e.recapSurplusRow.style.display="flex";
      if(e.recapDivider)e.recapDivider.style.display="block";
    }else{
      if(e.recapSurplusRow)e.recapSurplusRow.style.display="none";
      if(e.recapDivider)e.recapDivider.style.display="none";
    }

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

  if(e.manualIsSurplus){
    isSurplusMode=e.manualIsSurplus.checked;
    currentNote=isSurplusMode?(e.manualNote?.value||"").trim():"";
    if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.toggle("hidden",!isSurplusMode);
    if(e.confirmNoteDisplay){
      if(isSurplusMode && currentNote){
        e.confirmNoteDisplay.textContent=`Catatan: ${currentNote}`;
        e.confirmNoteDisplay.classList.remove("hidden");
      }else{
        e.confirmNoteDisplay.classList.add("hidden");
      }
    }
  }

  e.manualDialog.close();
};

if(e.manualIsSurplus){
  e.manualIsSurplus.onchange=()=>{
    if(e.manualNoteWrap){
      e.manualNoteWrap.style.display=e.manualIsSurplus.checked?"block":"none";
      if(e.manualIsSurplus.checked && e.manualNote){
        setTimeout(()=>e.manualNote.focus(),100);
      }
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

