const $=id=>document.getElementById(id);
const ids=[
  "camera","cameraEmpty","startCamera","toggleCamMode","capture","nativeCamBtn","nativeCamInput","fileInput",
  "openCashoutBtn","openSurplusBtn","openRevisedBtn","openExpenseBtn","confirmSurplusBadge","confirmCashoutBadge","confirmRevisedBadge","confirmExpenseBadge","toggleConfirmRevisedBtn","toggleConfirmRevisedText","toggleConfirmExpenseBtn","toggleConfirmExpenseText","confirmNoteDisplay",
  "result","preview","amount","save","manual","manualDialog","manualAmount","manualDate","manualTime",
  "dateTimeFieldGroup","manualSurplusGroup","manualIsSurplus","manualNoteWrap","manualNote",
  "manualCashoutGroup","manualIsCashout","manualCashoutNoteWrap","manualCashoutNote",
  "manualRevisedGroup","manualIsRevised","manualExpenseGroup","manualIsExpense","manualExpenseNoteWrap","manualExpenseNote",
  "displayDate","displayTime","applyManual",
  "surplusDialog","surplusAmount","surplusNote","surplusGalleryBtn","surplusGalleryText",
  "surplusFileInput","surplusPreviewWrap","surplusPreviewImg","removeSurplusPhoto","surplusAutoProofNote",
  "surplusDate","surplusTime","saveSurplusBtn",
  "cashoutDialog","cashoutAmount","cashoutNote","cashoutGalleryBtn","cashoutGalleryText",
  "cashoutFileInput","cashoutPreviewWrap","cashoutPreviewImg","removeCashoutPhoto","cashoutAutoProofNote",
  "cashoutDate","cashoutTime","cashoutIsRevised","saveCashoutBtn",
  "revisedDialog","revisedAmount","revisedNote","revisedGalleryBtn","revisedGalleryText",
  "revisedFileInput","revisedPreviewWrap","revisedPreviewImg","removeRevisedPhoto","revisedAutoProofNote",
  "revisedDate","revisedTime","saveRevisedBtn",
  "expenseDialog","expenseAmount","expenseNote","expenseGalleryBtn","expenseGalleryText",
  "expenseFileInput","expensePreviewWrap","expensePreviewImg","removeExpensePhoto","expenseAutoProofNote",
  "expenseDate","expenseTime","saveExpenseBtn",
  "rescan","canvas","success","shareText","share","copy","again","toast",
  "scanTab","historyTab","scanPage","historyPage","historyDate","historyLoading",
  "historyEmpty","historyList","recapBox","recapSalesRow","recapSalesTotal","recapSurplusRow","recapSurplusTotal","recapCashoutRow","recapCashoutTotal","recapRevisedRow","recapRevisedCount","recapDivider","historyTotal",
  "recapExpenseSection","recapExpenseCount","recapExpenseTotal","shareRecap","copyRecap",
  "groupedTransactions","groupedList","groupedSummaryBadge","groupedCopyBtn",
  "editDialog","editAmount","editDate","editTime","editIsSurplus","editNoteWrap","editNote","editIsCashout","editIsRevised","editIsExpense","editPinInput","saveEditBtn",
  "deleteDialog","deleteConfirmInfo","deletePinInput","deletePasswordInput","confirmDeleteBtn",
  "externalShortcut","settingsBtn","settingsDialog","settingDefaultCam","settingNativeCamMode","customPackageFields",
  "settingCustomPackage","settingShortcutEnabled","settingShortcutLabel","settingShortcutUrl","shortcutFields",
  "settingSurplusEnabled","settingCashoutEnabled","settingRevisionEnabled","settingExpenseEnabled","settingGroupedEnabled","settingRetentionDays","cleanNowBtn","saveSettingsBtn",
  "settingDelaySaveEnabled","openPendingBtn","pendingBadge",
  "pendingDialog","pendingList","pendingEmpty","pendingLoading","closePendingBtn","refreshPendingBtn",
  "pendingConfirmDialog","pendingConfirmImg","pendingConfirmAmount","pendingConfirmNote","pendingConfirmIsSurplus","pendingConfirmIsCashout","pendingConfirmIsExpense","savePendingConfirmBtn","cancelPendingConfirmBtn",
  "mobileAppUpdateSection","mobileCurrentVersionBadge","mobileUpdateHelpText","checkMobileUpdateBtn","checkMobileUpdateBtnText",
  "mobileUpdateVerifyBox","mobileUpdateTargetTag","mobileUpdateSizeInfo","mobileUpdateChangelog","executeMobileUpdateBtn","openMobileUpdateBtn","dismissMobileUpdateBtn",
  "modeSectionLabel",
  "imagePreviewDialog","imagePreviewModalImg","imagePreviewTitle","imagePreviewSubtitle","imagePreviewMeta","imagePreviewCloseBtn","imagePreviewOpenBrowserBtn","imagePreviewCopyLinkBtn",
  "imagePreviewFrame","imagePreviewZoomBadge","imagePreviewZoomInBtn","imagePreviewZoomOutBtn","imagePreviewZoomResetBtn","imagePreviewRotateBtn","imagePreviewDownloadBtn",
  "settingImagePreviewInApp","settingImagePreviewGroup","settingImagePreviewHelpText","webPreviewNotice","settingInstallBannerEnabled",
  "webInstallBanner","webInstallVersionBadge","webInstallPwaBtn","webInstallApkBtn","dismissInstallBannerBtn","webInstallApkBtnText"
];
const e=Object.fromEntries(ids.map(id=>[id,$(id)]));
let stream,imageBlob,amount=0,recapText="",originalTime="",originalDate="",pendingDeleteRecord=null,pendingEditRecord=null;
let inputSource="camera";
let currentFacingMode=localStorage.getItem("preferredFacingMode")||"environment";
let allVideoDevices=[];
let currentDeviceIndex=0;
let currentRole="kasir";
let isSurplusMode=false,isCashoutMode=false,isRevisedMode=false,isExpenseMode=false,currentNote="",surplusSelectedBlob=null,cashoutSelectedBlob=null,revisedSelectedBlob=null,expenseSelectedBlob=null;

const rupiah=n=>new Intl.NumberFormat("id-ID").format(n);
const escapeHtml=s=>String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const formatReceiptLine=(time,amt,isSurplus,isCashout,isRevised,note,isExpense)=>{
  const tags=[];
  if(isExpense){
    tags.push(note?`Struk Cash: ${note}`:"Struk Cash");
  }else if(isSurplus){
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
// Versi ringkas untuk teks rekap/setoran: label pendek + catatan dipotong
const shortNote=(note,max=18)=>{
  const n=String(note||"").replace(/\s+/g," ").trim();
  return n.length>max?n.slice(0,max-1).trimEnd()+"…":n;
};
const formatReceiptLineCompact=(time,amt,isSurplus,isCashout,isRevised,note,isExpense)=>{
  const tags=[];
  const n=shortNote(note);
  if(isExpense)tags.push(n?`Cash: ${n}`:"Cash");
  else if(isSurplus)tags.push(n?`Surplus: ${n}`:"Surplus");
  else if(isCashout)tags.push(n?`Tukar: ${n}`:"Tukar");
  else if(n)tags.push(n);
  if(isRevised)tags.push("Rev");
  const tagStr=tags.length?` (${tags.join(", ")})`:"";
  return `${time} - ${rupiah(amt)}${tagStr}`;
};
// === TOAST NOTIFIKASI (tipe: success | error | warning | info | loading) ===
const TOAST_META={
  success:{title:"Berhasil",icon:'<polyline points="20 6 9 17 4 12"/>'},
  error:{title:"Gagal",icon:'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'},
  warning:{title:"Perhatian",icon:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'},
  info:{title:"Info",icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'},
  loading:{title:"Memproses",icon:'<path d="M21 12a9 9 0 1 1-6.22-8.56"/>'}
};
const inferToastType=t=>{
  const s=t.toLowerCase();
  if(/offline|antrean|butuh|beralih|belum/.test(s))return "warning";
  if(/gagal|tidak valid|tidak dapat|tidak bisa|tidak tersedia|ditolak|wajib|masukkan|error|salah/.test(s))return "error";
  if(/berhasil|tersimpan|disimpan|disalin|dikonfirmasi|selesai|sukses|dihapus|diperbarui|dimuat|dicatat/.test(s))return "success";
  return "info";
};
const supportsPopover=typeof HTMLElement!=="undefined"&&Object.prototype.hasOwnProperty.call(HTMLElement.prototype,"popover");
let toastTimer=0,toastHideTimer=0;
if(e.toast){
  e.toast.setAttribute("role","status");
  e.toast.setAttribute("aria-live","polite");
  // Popover masuk ke "top layer" sehingga toast tetap terlihat di atas dialog modal
  if(supportsPopover)e.toast.setAttribute("popover","manual");
  e.toast.addEventListener("click",()=>hideToast());
}
function hideToast(){
  clearTimeout(toastTimer);
  if(!e.toast)return;
  e.toast.classList.remove("show");
  clearTimeout(toastHideTimer);
  toastHideTimer=setTimeout(()=>{
    if(supportsPopover&&!e.toast.classList.contains("show")){try{e.toast.hidePopover();}catch(_){}}
  },280);
}
function toast(msg,type){
  const text=String(msg??"").trim();
  if(!text||!e.toast)return;
  const kind=TOAST_META[type]?type:inferToastType(text);
  const meta=TOAST_META[kind];
  const duration=kind==="loading"?15000:Math.min(5200,Math.max(2400,text.length*60));
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  e.toast.className=`toast toast-${kind}`;
  e.toast.innerHTML=`<span class="toast-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"${kind==="loading"?' class="toast-spin"':""}>${meta.icon}</svg></span><span class="toast-body"><strong class="toast-title">${meta.title}</strong><span class="toast-msg">${escapeHtml(text)}</span></span><span class="toast-progress" style="animation-duration:${duration}ms"></span>`;
  if(supportsPopover){
    try{
      if(e.toast.matches(":popover-open"))e.toast.hidePopover();
      e.toast.showPopover();
    }catch(_){}
  }
  void e.toast.offsetWidth;
  requestAnimationFrame(()=>e.toast.classList.add("show"));
  toastTimer=setTimeout(hideToast,duration);
}
function hapticTap(ms=40){
  try{
    if(window.QriskasAndroid&&typeof window.QriskasAndroid.vibrate==="function")window.QriskasAndroid.vibrate(ms);
    else if(window.AndroidBridge&&typeof window.AndroidBridge.vibrate==="function")window.AndroidBridge.vibrate(ms);
    else if(navigator.vibrate)navigator.vibrate(ms);
  }catch(_){}
}
const localDate=()=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`};
const currentJakartaTime=()=>{const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(),v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.hour}:${v.minute}`};

// Cek apakah context aman (HTTPS atau localhost)
const isSecureContext=()=>location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1"||location.hostname.endsWith(".local");
const isMobileApp=()=>Boolean(window.__isAndroidApp || window.QriskasAndroid || window.AndroidBridge);

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
  const expenseEnabled=localStorage.getItem("expenseEnabled")!=="false";
  const delaySaveEnabled=localStorage.getItem("delaySaveEnabled")==="true";
  const imagePreviewMode=localStorage.getItem("imagePreviewMode")||"browser";
  const installBannerEnabled=localStorage.getItem("installBannerEnabled")!=="false";
  const recapCompact=localStorage.getItem("recapCompact")==="true";
  return {facing,nativeCamMode,customPackage,shortcutEnabled,shortcutLabel,shortcutUrl,groupedEnabled,surplusEnabled,cashoutEnabled,revisionEnabled,expenseEnabled,delaySaveEnabled,imagePreviewMode,installBannerEnabled,recapCompact};
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
    if(e.openRevisedBtn) e.openRevisedBtn.style.display="none";
    if(e.openExpenseBtn) e.openExpenseBtn.style.display="none";
    if(e.manualSurplusGroup) e.manualSurplusGroup.style.display="none";
    if(e.manualCashoutGroup) e.manualCashoutGroup.style.display="none";
    if(e.manualRevisedGroup) e.manualRevisedGroup.style.display="none";
    if(e.manualExpenseGroup) e.manualExpenseGroup.style.display="none";
    if(e.toggleConfirmExpenseBtn) e.toggleConfirmExpenseBtn.style.display="none";
    if(e.modeSectionLabel) e.modeSectionLabel.style.display="none";
    return;
  }

  // Judul seksi mode hanya tampil jika minimal satu mode aktif
  if(e.modeSectionLabel){
    e.modeSectionLabel.style.display=(s.surplusEnabled||s.cashoutEnabled||s.revisionEnabled||s.expenseEnabled)?"":"none";
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

  if(e.openRevisedBtn){
    e.openRevisedBtn.style.display=s.revisionEnabled?"flex":"none";
  }
  if(e.manualRevisedGroup){
    e.manualRevisedGroup.style.display=s.revisionEnabled?"block":"none";
  }

  if(e.openExpenseBtn){
    e.openExpenseBtn.style.display=s.expenseEnabled?"flex":"none";
  }
  if(e.manualExpenseGroup){
    e.manualExpenseGroup.style.display=s.expenseEnabled?"block":"none";
  }
  if(e.toggleConfirmExpenseBtn){
    e.toggleConfirmExpenseBtn.style.display=s.expenseEnabled?"inline-flex":"none";
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

  // Tampilkan/sembunyikan tombol pending berdasarkan setting delay save
  if(e.openPendingBtn){
    e.openPendingBtn.style.display=s.delaySaveEnabled?"flex":"none";
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
  if(e.settingExpenseEnabled)e.settingExpenseEnabled.checked=s.expenseEnabled;
  if(e.settingGroupedEnabled)e.settingGroupedEnabled.checked=s.groupedEnabled;
  const compactEl=document.getElementById("settingRecapCompact");
  if(compactEl)compactEl.checked=s.recapCompact;
  if(e.settingDelaySaveEnabled)e.settingDelaySaveEnabled.checked=s.delaySaveEnabled;

  try{
    const res=await fetch("/api/config/retention");
    if(res.ok){
      const data=await res.json();
      if(e.settingRetentionDays && typeof data.retentionDays!=="undefined"){
        e.settingRetentionDays.value=String(data.retentionDays);
      }
    }
  }catch(_){}

  const isAndroid = isMobileApp();
  if (e.settingImagePreviewInApp) {
    if (!isAndroid) {
      e.settingImagePreviewInApp.checked = false;
      e.settingImagePreviewInApp.disabled = true;
      if (e.webPreviewNotice) e.webPreviewNotice.style.display = "block";
      if (e.settingImagePreviewHelpText) {
        e.settingImagePreviewHelpText.textContent = "Fitur modal pratinjau di dalam aplikasi eksklusif untuk aplikasi Android. Di browser web, foto akan selalu dibuka di tab baru melalui Web Viewer aman.";
      }
    } else {
      e.settingImagePreviewInApp.disabled = false;
      e.settingImagePreviewInApp.checked = s.imagePreviewMode === "in_app";
      if (e.webPreviewNotice) e.webPreviewNotice.style.display = "none";
      if (e.settingImagePreviewHelpText) {
        e.settingImagePreviewHelpText.textContent = "Aktifkan modal pratinjau foto interaktif (zoom, putar, simpan) langsung di dalam aplikasi HP. Jika dinonaktifkan, foto dibuka di tab baru.";
      }
    }
  }
  if(e.settingInstallBannerEnabled) e.settingInstallBannerEnabled.checked = s.installBannerEnabled !== false;

  // Verifikasi Pembaruan untuk Web dan Android
  if(e.mobileAppUpdateSection){
    e.mobileAppUpdateSection.style.display = "block";
    if(isAndroid){
      let ver = "1.2.0";
      if(window.QriskasAndroid && typeof window.QriskasAndroid.getAppVersionName === "function"){
        ver = window.QriskasAndroid.getAppVersionName();
      }
      if(e.mobileCurrentVersionBadge) e.mobileCurrentVersionBadge.textContent = "v" + ver + " (Android)";
      if(e.mobileUpdateHelpText) e.mobileUpdateHelpText.textContent = "Versi aplikasi Android terpasang saat ini.";
      if(e.checkMobileUpdateBtnText) e.checkMobileUpdateBtnText.textContent = "Periksa Pembaruan Android";
    }else{
      if(e.mobileCurrentVersionBadge) e.mobileCurrentVersionBadge.textContent = "Web PWA";
      if(e.mobileUpdateHelpText) e.mobileUpdateHelpText.textContent = "Periksa versi web terbaru & ketersediaan rilis APK Android.";
      if(e.checkMobileUpdateBtnText) e.checkMobileUpdateBtnText.textContent = "Periksa Pembaruan Web & APK";
    }
  }

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
  const expenseEnabled=e.settingExpenseEnabled?e.settingExpenseEnabled.checked:true;
  const groupedEnabled=e.settingGroupedEnabled?e.settingGroupedEnabled.checked:true;
  const delaySaveEnabled=e.settingDelaySaveEnabled?e.settingDelaySaveEnabled.checked:false;
  const isAndroid = isMobileApp();
  const imagePreviewMode = (isAndroid && e.settingImagePreviewInApp && e.settingImagePreviewInApp.checked) ? "in_app" : "browser";
  const installBannerEnabled=e.settingInstallBannerEnabled?e.settingInstallBannerEnabled.checked:true;
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
  localStorage.setItem("expenseEnabled",String(expenseEnabled));
  localStorage.setItem("groupedEnabled",String(groupedEnabled));
  const compactEl=document.getElementById("settingRecapCompact");
  if(compactEl)localStorage.setItem("recapCompact",String(compactEl.checked));
  localStorage.setItem("delaySaveEnabled",String(delaySaveEnabled));
  localStorage.setItem("imagePreviewMode",imagePreviewMode);
  localStorage.setItem("installBannerEnabled",String(installBannerEnabled));

  applySettingsUI({facing,nativeCamMode,customPackage,shortcutEnabled,shortcutLabel,shortcutUrl,groupedEnabled,surplusEnabled,cashoutEnabled,revisionEnabled,expenseEnabled,delaySaveEnabled,imagePreviewMode,installBannerEnabled});
  if(!installBannerEnabled && e.webInstallBanner){
    e.webInstallBanner.classList.add("hidden");
  }
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

async function getAllVideoInputDevices(force=false){
  if(!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  if(!force && allVideoDevices.length) return allVideoDevices;
  try{
    const devices=await navigator.mediaDevices.enumerateDevices();
    allVideoDevices=devices.filter(d=>d.kind==="videoinput");
    return allVideoDevices;
  }catch(_){
    return allVideoDevices;
  }
}

async function toggleCamera(){
  if(cameraStarting)return;
  currentFacingMode=currentFacingMode==="environment"?"user":"environment";
  localStorage.setItem("preferredFacingMode",currentFacingMode);
  updateCamToggleBtnText();
  if(e.toggleCamMode)e.toggleCamMode.disabled=true;
  try{
    await startCamera();
  }finally{
    if(e.toggleCamMode)e.toggleCamMode.disabled=false;
  }
}

async function refreshVideoDevices(){
  return await getAllVideoInputDevices(true);
}

// === KAMERA LIVE: pilih lensa utama, cache deviceId, resolusi tinggi & cepat ===
const CAM_RES={width:{ideal:1920},height:{ideal:1080}};
const FRONT_LABEL_RE=/front|user|depan|selfie/i;
const BACK_LABEL_RE=/back|rear|environment|belakang/i;
const AUX_LENS_RE=/ultra|tele|macro|depth|infrared|\bir\b|\btof\b/i;
let cameraWanted=false;   // true setelah kamera live pernah berhasil aktif
let cameraStarting=null;  // promise startCamera yang sedang berjalan (cegah double start)
let capturing=false;

const camCard=()=>e.camera?e.camera.closest(".camera-card"):null;
const byDevice=id=>({video:{deviceId:{exact:id},...CAM_RES},audio:false});

// Urutkan kamera belakang: lensa utama dulu, ultra-wide/tele/macro paling akhir
function rankBackDevices(devices){
  return devices
    .filter(d=>d.deviceId&&!FRONT_LABEL_RE.test(d.label||""))
    .map((d,order)=>{
      const l=d.label||"";
      let score=0;
      if(BACK_LABEL_RE.test(l))score+=4;
      if(/camera2? 0\b|^back camera$|main/i.test(l))score+=3;
      if(AUX_LENS_RE.test(l))score-=6;
      const m=l.match(/camera2?\s+(\d+)/i);
      return {d,score,idx:m?Number(m[1]):order};
    })
    .sort((a,b)=>b.score-a.score||a.idx-b.idx)
    .map(x=>x.d);
}

function pickDevicesFor(mode,devices){
  // Label baru tersedia setelah izin kamera diberikan
  if(!devices.some(d=>(d.label||"").trim()))return [];
  return mode==="environment"
    ?rankBackDevices(devices)
    :devices.filter(d=>d.deviceId&&FRONT_LABEL_RE.test(d.label||""));
}

function releaseStream(){
  if(stream){
    stream.getTracks().forEach(t=>{try{t.stop();}catch(_){}});
    stream=null;
  }
  if(e.camera&&e.camera.srcObject)e.camera.srcObject=null;
}

// Saat izin pertama label belum ada, setelah izin diberikan periksa apakah lensa perlu switch ke lensa utama
async function upgradeToMainLens(s,mode){
  if(mode!=="environment")return s;
  const current=s.getVideoTracks()[0]?.getSettings?.().deviceId;
  const devs=await getAllVideoInputDevices(true);
  const best=pickDevicesFor(mode,devs)[0];
  if(!current||!best||best.deviceId===current||!BACK_LABEL_RE.test(best.label||""))return s;
  s.getTracks().forEach(t=>t.stop());
  try{
    return await navigator.mediaDevices.getUserMedia(byDevice(best.deviceId));
  }catch(_){
    return await navigator.mediaDevices.getUserMedia(byDevice(current));
  }
}

async function getCameraStream(targetMode){
  const hadStream=Boolean(stream);
  releaseStream();
  // Jeda sangat singkat (40ms) jika stream lama baru dilepas agar driver kamera siap
  if(hadStream)await new Promise(r=>setTimeout(r,40));

  const cacheKey=`camDevice_${targetMode}`;
  const cachedId=localStorage.getItem(cacheKey);
  const constraintsList=[];

  // 1. Prioritaskan deviceId cache jika sudah pernah tersimpan sebelumnya (instan)
  if(cachedId){
    constraintsList.push(byDevice(cachedId));
  }

  // 2. Jika ada device input yang sudah ter-enumerate dan valid
  if(allVideoDevices.length){
    for(const d of pickDevicesFor(targetMode,allVideoDevices)){
      if(d.deviceId!==cachedId)constraintsList.push(byDevice(d.deviceId));
    }
  }

  // 3. Fallback standar facingMode ideal
  constraintsList.push({video:{facingMode:{ideal:targetMode},...CAM_RES},audio:false});
  constraintsList.push({video:{facingMode:{ideal:targetMode}},audio:false});

  let lastError=null;
  for(const c of constraintsList){
    try{
      let s=await navigator.mediaDevices.getUserMedia(c);
      if(!c.video.deviceId)s=await upgradeToMainLens(s,targetMode);
      const id=s.getVideoTracks()[0]?.getSettings?.().deviceId;
      if(id)localStorage.setItem(cacheKey,id);
      // Refresh daftar device di background tanpa menghambat
      getAllVideoInputDevices(true).catch(()=>{});
      return s;
    }catch(err){
      lastError=err;
      if(c.video.deviceId&&c.video.deviceId.exact===cachedId)localStorage.removeItem(cacheKey);
      if(err&&(err.name==="NotAllowedError"||err.name==="SecurityError"))throw err;
    }
  }

  // Fallback terakhir: minta izin stream umum
  try{
    const tempStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    const best=pickDevicesFor(targetMode,await getAllVideoInputDevices(true))[0];
    if(best){
      tempStream.getTracks().forEach(t=>t.stop());
      return await navigator.mediaDevices.getUserMedia(byDevice(best.deviceId));
    }
    return tempStream;
  }catch(err2){
    lastError=err2;
  }

  throw lastError||new Error("Kamera tidak dapat diakses.");
}

function applyTrackEnhancements(track){
  if(!track||typeof track.getCapabilities!=="function")return;
  try{
    const caps=track.getCapabilities()||{};
    const adv={};
    if(Array.isArray(caps.focusMode)&&caps.focusMode.includes("continuous"))adv.focusMode="continuous";
    if(Array.isArray(caps.exposureMode)&&caps.exposureMode.includes("continuous"))adv.exposureMode="continuous";
    if(Array.isArray(caps.whiteBalanceMode)&&caps.whiteBalanceMode.includes("continuous"))adv.whiteBalanceMode="continuous";
    if(Object.keys(adv).length)track.applyConstraints({advanced:[adv]}).catch(()=>{});
  }catch(_){}
}

async function waitForVideoReady(v){
  try{await v.play();}catch(_){}
  if(v.videoWidth>0)return;
  await new Promise(resolve=>{
    let done=false;
    const finish=()=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      v.removeEventListener("loadedmetadata",finish);
      v.removeEventListener("playing",finish);
      v.removeEventListener("timeupdate",finish);
      resolve();
    };
    const timer=setTimeout(finish,1500);
    v.addEventListener("loadedmetadata",finish,{once:true});
    v.addEventListener("playing",finish,{once:true});
    v.addEventListener("timeupdate",finish,{once:true});
  });
}

// Lepas hardware kamera (hemat baterai saat tab Riwayat / aplikasi di background)
function stopCamera(){
  releaseStream();
  camCard()?.classList.remove("live");
  if(e.capture)e.capture.disabled=true;
}

function shouldRunLiveCamera(){
  return cameraWanted&&currentRole!=="guest"&&!document.hidden&&!e.scanPage.classList.contains("hidden");
}

function resumeLiveCamera(){
  if(!shouldRunLiveCamera())return;
  if(stream){
    if(e.camera.paused)e.camera.play().catch(()=>{});
    e.capture.disabled=false;
    return;
  }
  startCamera({silent:true});
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

async function startCamera(opts){
  // opts.silent: dipakai saat resume otomatis, tidak memunculkan toast / kamera bawaan HP
  const silent=Boolean(opts&&opts.silent===true);
  if(cameraStarting)return cameraStarting;
  cameraStarting=startCameraInner(silent).finally(()=>{cameraStarting=null;});
  return cameraStarting;
}

async function startCameraInner(silent){
  if(!isSecureContext()){
    if(!silent)toast("Kamera live butuh koneksi HTTPS. Buka lewat https:// atau localhost.","warning");
    return;
  }
  if(!("mediaDevices" in navigator)||!navigator.mediaDevices.getUserMedia){
    if(!silent)triggerNativeCamera();
    return;
  }

  updateCamToggleBtnText();
  const card=camCard();

  try{
    if(e.startCamera)e.startCamera.textContent="Membuka kamera...";
    if(e.capture)e.capture.disabled=true;
    stream=await getCameraStream(currentFacingMode);

    e.camera.setAttribute("playsinline","true");
    e.camera.setAttribute("webkit-playsinline","true");
    e.camera.muted=true;
    e.camera.srcObject=stream;

    // Tampilkan UI scanner langsung aktif begitu stream terhubung
    const track=stream.getVideoTracks()[0];
    applyTrackEnhancements(track);
    const facing=track?.getSettings?.().facingMode||currentFacingMode;
    if(card){
      card.classList.toggle("mirrored",facing==="user");
      card.classList.add("live");
    }

    cameraWanted=true;
    e.cameraEmpty.classList.add("hidden");
    e.startCamera.classList.add("hidden");
    e.startCamera.textContent="Aktifkan Kamera";
    e.capture.disabled=false;

    // Tunggu video play secara asinkron tanpa menahan UI
    await waitForVideoReady(e.camera);
  }catch(err){
    console.warn("Live in-app camera error, falling back to hardware native camera:", err);
    releaseStream();
    cameraWanted=false;
    if(card)card.classList.remove("live");
    e.capture.disabled=true;
    e.cameraEmpty.classList.remove("hidden");
    e.startCamera.classList.remove("hidden");
    e.startCamera.textContent="Coba Lagi";
    if(silent)return;

    // Auto-fallback jika berjalan di Android App
    if(window.QriskasAndroid || window.AndroidBridge || window.__isAndroidApp){
      toast("Kamera live tidak tersedia. Membuka kamera bawaan HP.","warning");
      triggerNativeCamera();
    } else {
      const errMsg=err?.name==="NotAllowedError"?"Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser.":
                   err?.name==="NotReadableError"?"Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.":
                   "Kamera live tidak tersedia. Gunakan tombol Kamera HP.";
      toast(errMsg,"error");
    }
  }
}

// Jepret dari kamera live: respon instan, haptic feedback, tanpa efek flash macet/freeze
async function captureFromCamera(){
  if(capturing)return;
  if(!stream||!e.camera.videoWidth){
    toast("Kamera belum siap. Tunggu sebentar lalu coba lagi.","warning");
    return;
  }
  capturing=true;
  if(e.capture) e.capture.disabled=true;
  hapticTap(35);
  try{
    await useSource(e.camera,"camera");
  }finally{
    capturing=false;
    if(e.capture) e.capture.disabled=!stream;
  }
}

document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    if(stream)stopCamera();
  }else if(e.result.classList.contains("hidden")&&e.success.classList.contains("hidden")){
    resumeLiveCamera();
  }
});

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

  if(e.manualIsExpense){
    e.manualIsExpense.checked=Boolean(isExpenseMode);
    if(e.manualExpenseNoteWrap)e.manualExpenseNoteWrap.style.display=isExpenseMode?"block":"none";
    if(e.manualExpenseNote)e.manualExpenseNote.value=isExpenseMode?currentNote:"";
  }

  e.manualDialog.showModal();
  setTimeout(()=>e.manualAmount.focus(),100);
}

function updateRevisedToggleUI(){
  if(e.confirmRevisedBadge)e.confirmRevisedBadge.classList.toggle("hidden",!isRevisedMode);
  if(e.toggleConfirmRevisedBtn){
    e.toggleConfirmRevisedBtn.classList.toggle("active",Boolean(isRevisedMode));
    if(e.toggleConfirmRevisedText){
      e.toggleConfirmRevisedText.textContent=isRevisedMode?"Label Revisi Aktif":"+ Beri Label Revisi";
    }
  }
}

function updateExpenseToggleUI(){
  if(e.confirmExpenseBadge)e.confirmExpenseBadge.classList.toggle("hidden",!isExpenseMode);
  if(e.toggleConfirmExpenseBtn){
    e.toggleConfirmExpenseBtn.classList.toggle("active",Boolean(isExpenseMode));
    if(e.toggleConfirmExpenseText){
      e.toggleConfirmExpenseText.textContent=isExpenseMode?"Struk Cash Aktif":"+ Tandai Struk Cash";
    }
  }
}

async function useSource(s, source="camera"){
  inputSource=source;
  // Resolusi 1280px sangat tajam untuk struk kasir, namun 2x lebih cepat dan bebas freeze di HP kasir
  const MAX_EDGE=1280;
  const w=s.videoWidth||s.naturalWidth;
  const h=s.videoHeight||s.naturalHeight;
  if(!w || !h){
    toast("Kamera belum siap memuat frame. Coba ulangi.","warning");
    return;
  }
  const z=Math.min(1,MAX_EDGE/Math.max(w,h));
  e.canvas.width=Math.round(w*z);e.canvas.height=Math.round(h*z);
  const ctx=e.canvas.getContext("2d");
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="medium";
  ctx.drawImage(s,0,0,e.canvas.width,e.canvas.height);
  imageBlob=await canvasBlob(e.canvas,.78);

  // === DELAY SAVE MODE: Jika aktif, langsung upload foto sebagai pending & kembali ke kamera ===
  const settings=loadSettings();
  if(settings.delaySaveEnabled && (source==="camera"||source==="native_camera")){
    await handleDelaySave(imageBlob);
    return;
  }

  // Tidak mem-pause e.camera agar pipeline kamera hardware Android tidak macet/freeze
  e.preview.src=URL.createObjectURL(imageBlob);
  amount=0;e.amount.textContent="0";
  
  // Update badge display berdasarkan state aktif
  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.toggle("hidden",!isSurplusMode);
  if(e.confirmCashoutBadge)e.confirmCashoutBadge.classList.toggle("hidden",!isCashoutMode);
  updateRevisedToggleUI();
  updateExpenseToggleUI();
  if(e.confirmNoteDisplay){
    if((isSurplusMode||isCashoutMode||isExpenseMode) && currentNote){
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

// === DELAY SAVE: Upload foto langsung sebagai pending ===
async function handleDelaySave(blob){
  toast("Menyimpan foto ke daftar pending...","loading");
  try{
    const fd=new FormData();
    fd.append("image",blob,"bukti-pending.jpg");
    const res=await fetch("/api/pending",{method:"POST",body:fd});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error);
    toast("Foto tersimpan. Isi nominalnya nanti lewat menu Pending.","success");
    updatePendingBadge();
    // Vibrate feedback
    if(window.QriskasAndroid && typeof window.QriskasAndroid.vibrate==="function"){
      window.QriskasAndroid.vibrate(80);
    } else if(window.AndroidBridge && typeof window.AndroidBridge.vibrate==="function"){
      window.AndroidBridge.vibrate(80);
    } else if(navigator.vibrate){
      navigator.vibrate(80);
    }
  }catch(err){
    toast(err.message||"Gagal menyimpan foto pending");
  }
}

// === PENDING BADGE COUNT ===
async function updatePendingBadge(){
  if(!e.pendingBadge) return;
  try{
    const res=await fetch(`/api/pending?date=${localDate()}`);
    if(!res.ok) return;
    const data=await res.json();
    const count=data.records?data.records.length:0;
    e.pendingBadge.textContent=count>0?String(count):"";
    e.pendingBadge.style.display=count>0?"flex":"none";
  }catch(_){}
}

// === PENDING DIALOG ===
let pendingConfirmRecord=null;

async function openPendingDialog(){
  if(e.pendingDialog) e.pendingDialog.showModal();
  await loadPendingList();
}

async function loadPendingList(){
  if(e.pendingLoading) e.pendingLoading.classList.remove("hidden");
  if(e.pendingEmpty) e.pendingEmpty.classList.add("hidden");
  if(e.pendingList) e.pendingList.innerHTML="";
  try{
    const res=await fetch(`/api/pending?date=${localDate()}`);
    const data=await res.json();
    if(!res.ok) throw new Error(data.error);
    const records=data.records||[];
    if(!records.length){
      if(e.pendingEmpty) e.pendingEmpty.classList.remove("hidden");
      return;
    }
    for(const r of records){
      const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(r.savedAt));
      const item=document.createElement("article");
      item.className="pending-item";
      item.innerHTML=`<img class="pending-item-thumb" src="${r.imageUrl}" alt="Foto Pending" loading="lazy"><div class="pending-item-body"><div class="pending-item-meta"><time class="pending-item-time">${time} WIB</time><span class="badge-pending">PENDING</span></div><div class="pending-item-actions"><button class="confirm-pending-btn" type="button">Isi Nominal</button></div></div>`;
      item.querySelector(".pending-item-thumb").onclick=()=>{
        openImagePreview(r.viewUrl || r.imageUrl, {
          title: "Foto Bukti Pending",
          time,
          date: localDate(),
          badgeLabel: "PENDING",
          badgeClass: "badge-pending",
          note: r.note || "Menunggu pengisian nominal",
          viewUrl: r.viewUrl,
          rawViewUrl: r.rawViewUrl,
          imageKey: r.imageKey
        });
      };
      const confirmBtn = item.querySelector(".confirm-pending-btn");
      if (confirmBtn) {
        confirmBtn.onclick = () => openPendingConfirm(r);
      }
      const itemBody = item.querySelector(".pending-item-body");
      if (itemBody) {
        itemBody.onclick = (ev) => {
          if (!ev.target.closest("button")) {
            openPendingConfirm(r);
          }
        };
      }
      e.pendingList.append(item);
    }
  }catch(err){
    toast(err.message||"Gagal memuat pending");
  }finally{
    if(e.pendingLoading) e.pendingLoading.classList.add("hidden");
  }
}

function openPendingConfirm(record){
  pendingConfirmRecord=record;
  if(e.pendingConfirmImg) {
    e.pendingConfirmImg.src=record.imageUrl;
    e.pendingConfirmImg.title="Klik untuk memperbesar pratinjau foto";
    e.pendingConfirmImg.onclick=()=>{
      openImagePreview(record.viewUrl || record.imageUrl, {
        title: "Foto Bukti Pending",
        amount: Number((e.pendingConfirmAmount?.value || "").replace(/\D/g, "")) || 0,
        badgeLabel: "PENDING",
        badgeClass: "badge-pending",
        note: e.pendingConfirmNote?.value || "",
        viewUrl: record.viewUrl,
        rawViewUrl: record.rawViewUrl,
        imageKey: record.imageKey
      });
    };
  }
  if(e.pendingConfirmAmount) e.pendingConfirmAmount.value = record.amount ? rupiah(record.amount) : "";
  if(e.pendingConfirmNote) e.pendingConfirmNote.value = record.note || "";
  if(e.pendingConfirmIsSurplus) e.pendingConfirmIsSurplus.checked = Boolean(record.isSurplus);
  if(e.pendingConfirmIsCashout) e.pendingConfirmIsCashout.checked = Boolean(record.isCashout);
  if(e.pendingConfirmIsExpense) e.pendingConfirmIsExpense.checked = Boolean(record.isExpense);
  if(e.pendingConfirmDialog){
    e.pendingConfirmDialog.showModal();
    setTimeout(()=>e.pendingConfirmAmount?.focus(),100);
  }
}

async function handleSavePendingConfirm(ev){
  ev.preventDefault();
  if(!pendingConfirmRecord) return;
  const amt=Number((e.pendingConfirmAmount?.value||"").replace(/\D/g,""));
  if(!amt) return toast("Masukkan nominal yang benar");
  const note=(e.pendingConfirmNote?.value||"").trim();
  const isSurplus=e.pendingConfirmIsSurplus?e.pendingConfirmIsSurplus.checked:false;
  const isCashout=e.pendingConfirmIsCashout?e.pendingConfirmIsCashout.checked:false;
  const isExpense=e.pendingConfirmIsExpense?e.pendingConfirmIsExpense.checked:false;

  if(e.savePendingConfirmBtn){
    e.savePendingConfirmBtn.disabled=true;
    e.savePendingConfirmBtn.textContent="Menyimpan…";
  }

  try{
    const res=await fetch("/api/pending",{
      method:"PATCH",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        recordKey:pendingConfirmRecord.recordKey,
        amount:amt,
        note,isSurplus,isCashout,isExpense
      })
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error);
    toast("Transaksi pending berhasil dikonfirmasi","success");
    if(e.pendingConfirmDialog) e.pendingConfirmDialog.close();
    pendingConfirmRecord=null;
    await loadPendingList();
    updatePendingBadge();
    loadHistory(true);
  }catch(err){
    toast(err.message||"Gagal konfirmasi pending");
  }finally{
    if(e.savePendingConfirmBtn){
      e.savePendingConfirmBtn.disabled=false;
      e.savePendingConfirmBtn.textContent="Konfirmasi & Simpan";
    }
  }
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
      isExpense: Boolean(isExpenseMode),
      note: currentNote,
      customDate: selectedDate,
      customTime: selectedTime,
      imageBlob: imageBlob
    });
    const line=formatReceiptLine(selectedTime, amount, isSurplusMode, isCashoutMode, isRevisedMode, currentNote, isExpenseMode);
    e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Disimpan di antrean offline. Data akan disinkronkan otomatis saat internet tersambung.","warning");
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
    fd.append("isExpense",String(Boolean(isExpenseMode)));
    if(currentNote) fd.append("note",currentNote);
    if(selectedDate) fd.append("customDate",selectedDate);
    if(selectedTime) fd.append("customTime",selectedTime);

    const response=await fetch("/api/receipts",{method:"POST",body:fd});
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.error);
    }

    const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(data.savedAt));
    const line=formatReceiptLine(time,data.amount,data.isSurplus,data.isCashout,data.isRevised,data.note,data.isExpense);
    e.shareText.textContent=`${line} gambar ${data.viewUrl || data.imageUrl}`;
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
        isExpense: Boolean(isExpenseMode),
        note: currentNote,
        customDate: selectedDate,
        customTime: selectedTime,
        imageBlob: imageBlob
      });
      const line=formatReceiptLine(selectedTime, amount, isSurplusMode, isCashoutMode, isRevisedMode, currentNote, isExpenseMode);
      e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
      e.result.classList.add("hidden");
      e.success.classList.remove("hidden");
      e.success.scrollIntoView({behavior:"smooth"});
      toast("Disimpan di antrean offline. Data akan disinkronkan otomatis saat internet tersambung.","warning");
    } else {
      toast(x.message||"Gagal menyimpan");
    }
  }
  finally{e.save.disabled=false;e.save.textContent="Simpan";}
}

function reset(){
  e.result.classList.add("hidden");
  e.success.classList.add("hidden");
  resumeLiveCamera();
  imageBlob=null;amount=0;
  isSurplusMode=false;isCashoutMode=false;isRevisedMode=false;isExpenseMode=false;currentNote="";
  surplusSelectedBlob=null;cashoutSelectedBlob=null;revisedSelectedBlob=null;expenseSelectedBlob=null;
  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.add("hidden");
  if(e.confirmCashoutBadge)e.confirmCashoutBadge.classList.add("hidden");
  updateRevisedToggleUI();
  updateExpenseToggleUI();
  if(e.confirmNoteDisplay)e.confirmNoteDisplay.classList.add("hidden");
  if(e.manualIsSurplus)e.manualIsSurplus.checked=false;
  if(e.manualNoteWrap)e.manualNoteWrap.style.display="none";
  if(e.manualNote)e.manualNote.value="";
  if(e.manualIsCashout)e.manualIsCashout.checked=false;
  if(e.manualCashoutNoteWrap)e.manualCashoutNoteWrap.style.display="none";
  if(e.manualCashoutNote)e.manualCashoutNote.value="";
  if(e.manualIsRevised)e.manualIsRevised.checked=false;
  if(e.manualIsExpense)e.manualIsExpense.checked=false;
  if(e.manualExpenseNoteWrap)e.manualExpenseNoteWrap.style.display="none";
  if(e.manualExpenseNote)e.manualExpenseNote.value="";
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
  if(!sAmount)return toast("Masukkan nominal surplus yang valid", "warning");

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
    toast("Surplus disimpan di antrean offline", "warning");
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
    e.shareText.textContent=`${line} gambar ${data.viewUrl || data.imageUrl}`;
    if(e.surplusDialog)e.surplusDialog.close();

    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Surplus kas berhasil dicatat", "success");
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
      toast("Surplus disimpan di antrean offline", "warning");
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
  if(!cAmount)return toast("Masukkan nominal tukar cash yang valid", "warning");

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
    toast("Tukar cash disimpan di antrean offline", "warning");
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
    e.shareText.textContent=`${line} gambar ${data.viewUrl || data.imageUrl}`;
    if(e.cashoutDialog)e.cashoutDialog.close();

    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Tukar cash berhasil dicatat", "success");
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
      toast("Tukar cash disimpan di antrean offline", "warning");
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

async function generateRevisedProofImage(nominal,note,dateStr,timeStr){
  const c=document.createElement("canvas");
  c.width=800;c.height=600;
  const ctx=c.getContext("2d");
  const grad=ctx.createLinearGradient(0,0,800,600);
  grad.addColorStop(0,"#1a0f28");
  grad.addColorStop(1,"#090510");
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,800,600);

  ctx.strokeStyle="#c084fc";
  ctx.lineWidth=6;
  ctx.strokeRect(16,16,768,568);

  ctx.strokeStyle="#4c1d95";
  ctx.lineWidth=2;
  ctx.strokeRect(26,26,748,548);

  ctx.fillStyle="#ffd000";
  ctx.font="bold 22px system-ui,sans-serif";
  ctx.textAlign="center";
  ctx.fillText("TAHUNYA KRISPIYA • QRIS KAS",400,75);

  ctx.fillStyle="rgba(192,132,252,0.18)";
  ctx.fillRect(180,95,440,36);
  ctx.strokeStyle="#c084fc";
  ctx.lineWidth=1.5;
  ctx.strokeRect(180,95,440,36);

  ctx.fillStyle="#c084fc";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("BUKTI TRANSAKSI SUSULAN / REVISI",400,119);

  ctx.fillStyle="#a89f82";
  ctx.font="14px system-ui,sans-serif";
  ctx.fillText("NOMINAL TRANSAKSI TERCATAT",400,180);

  ctx.fillStyle="#ffffff";
  ctx.font="900 58px system-ui,sans-serif";
  ctx.fillText(`Rp${rupiah(nominal)}`,400,245);

  ctx.fillStyle="#120a1c";
  ctx.fillRect(70,285,660,200);
  ctx.strokeStyle="#4c1d95";
  ctx.lineWidth=1.5;
  ctx.strokeRect(70,285,660,200);

  ctx.textAlign="left";
  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("WAKTU TRANSAKSI SEBENARNYA",100,325);
  ctx.fillStyle="#fffef5";
  ctx.font="16px system-ui,sans-serif";
  ctx.fillText(`${dateStr} • ${timeStr} WIB`,100,350);

  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("KETERANGAN / ALASAN REVISI",100,395);
  ctx.fillStyle="#c084fc";
  ctx.font="italic 16px system-ui,sans-serif";
  const noteText=note||"Transaksi susulan / koreksi catatan kasir";
  ctx.fillText(noteText.length>55?noteText.slice(0,52)+"...":noteText,100,422);

  ctx.textAlign="center";
  ctx.fillStyle="#a89f82";
  ctx.font="12px system-ui,sans-serif";
  ctx.fillText("Tercatat Resmi Sebagai Transaksi Susulan • Siap Diverifikasi dengan Mutasi Bank",400,535);

  return await canvasBlob(c,0.85);
}

function openRevisedModal(){
  if(e.revisedAmount)e.revisedAmount.value="";
  if(e.revisedNote)e.revisedNote.value="";
  if(e.revisedDate)e.revisedDate.value=localDate();
  if(e.revisedTime)e.revisedTime.value=currentJakartaTime();
  revisedSelectedBlob=null;
  if(e.revisedPreviewWrap)e.revisedPreviewWrap.classList.add("hidden");
  if(e.revisedPreviewImg)e.revisedPreviewImg.src="";
  if(e.revisedGalleryText)e.revisedGalleryText.textContent="Pilih Foto Bukti dari Galeri";
  if(e.revisedFileInput)e.revisedFileInput.value="";
  if(e.revisedDialog){
    e.revisedDialog.showModal();
    setTimeout(()=>e.revisedAmount?.focus(),100);
  }
}

async function saveRevised(ev){
  ev.preventDefault();
  const rAmount=Number(e.revisedAmount.value.replace(/\D/g,""));
  if(!rAmount)return toast("Masukkan nominal transaksi yang valid", "warning");

  const rNote=(e.revisedNote.value||"").trim();
  const rDate=e.revisedDate.value||localDate();
  const rTime=e.revisedTime.value||currentJakartaTime();

  if(e.saveRevisedBtn){
    e.saveRevisedBtn.disabled=true;
    e.saveRevisedBtn.textContent="Menyimpan…";
  }

  // Jika sedang offline
  if(!navigator.onLine){
    let finalBlob=revisedSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateRevisedProofImage(rAmount,rNote,rDate,rTime);
    }
    await queueOfflineReceipt({
      amount: String(rAmount),
      isSurplus: false,
      isCashout: false,
      isRevised: true,
      note: rNote,
      customDate: rDate,
      customTime: rTime,
      imageBlob: finalBlob
    });
    const line=formatReceiptLine(rTime,rAmount,false,false,true,rNote);
    e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
    if(e.revisedDialog)e.revisedDialog.close();
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Transaksi revisi disimpan di antrean offline", "warning");
    if(e.saveRevisedBtn){
      e.saveRevisedBtn.disabled=false;
      e.saveRevisedBtn.textContent="Simpan Transaksi Revisi";
    }
    return;
  }

  try{
    let finalBlob=revisedSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateRevisedProofImage(rAmount,rNote,rDate,rTime);
    }

    const fd=new FormData();
    fd.append("image",finalBlob,"bukti-revisi.jpg");
    fd.append("amount",String(rAmount));
    fd.append("customDate",rDate);
    fd.append("customTime",rTime);
    fd.append("isRevised","true");
    if(rNote)fd.append("note",rNote);

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

    const line=formatReceiptLine(time,data.amount,false,false,true,data.note);
    e.shareText.textContent=`${line} gambar ${data.viewUrl || data.imageUrl}`;
    if(e.revisedDialog)e.revisedDialog.close();

    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Transaksi revisi berhasil dicatat", "success");
  }catch(err){
    if(!navigator.onLine || err.message?.includes("fetch") || err.message?.includes("NetworkError")){
      let finalBlob=revisedSelectedBlob;
      if(!finalBlob){
        finalBlob=await generateRevisedProofImage(rAmount,rNote,rDate,rTime);
      }
      await queueOfflineReceipt({
        amount: String(rAmount),
        isSurplus: false,
        isCashout: false,
        isRevised: true,
        note: rNote,
        customDate: rDate,
        customTime: rTime,
        imageBlob: finalBlob
      });
      const line=formatReceiptLine(rTime,rAmount,false,false,true,rNote);
      e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
      if(e.revisedDialog)e.revisedDialog.close();
      e.result.classList.add("hidden");
      e.success.classList.remove("hidden");
      e.success.scrollIntoView({behavior:"smooth"});
      toast("Transaksi revisi disimpan di antrean offline", "warning");
    } else {
      toast(err.message||"Gagal menyimpan transaksi revisi");
    }
  }finally{
    if(e.saveRevisedBtn){
      e.saveRevisedBtn.disabled=false;
      e.saveRevisedBtn.textContent="Simpan Transaksi Revisi";
    }
  }
}

async function generateExpenseProofImage(nominal,note,dateStr,timeStr){
  const c=document.createElement("canvas");
  c.width=800;c.height=600;
  const ctx=c.getContext("2d");
  const grad=ctx.createLinearGradient(0,0,800,600);
  grad.addColorStop(0,"#1c070c");
  grad.addColorStop(1,"#090204");
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,800,600);

  ctx.strokeStyle="#f43f5e";
  ctx.lineWidth=6;
  ctx.strokeRect(16,16,768,568);

  ctx.strokeStyle="#4a1523";
  ctx.lineWidth=2;
  ctx.strokeRect(26,26,748,548);

  ctx.fillStyle="#ffd000";
  ctx.font="bold 22px system-ui,sans-serif";
  ctx.textAlign="center";
  ctx.fillText("TAHUNYA KRISPIYA • QRIS KAS",400,75);

  ctx.fillStyle="rgba(244,63,94,0.18)";
  ctx.fillRect(160,95,480,36);
  ctx.strokeStyle="#f43f5e";
  ctx.lineWidth=1.5;
  ctx.strokeRect(160,95,480,36);

  ctx.fillStyle="#f43f5e";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("BUKTI STRUK BELANJA CASH (LACI FISIK)",400,119);

  ctx.fillStyle="#a89f82";
  ctx.font="14px system-ui,sans-serif";
  ctx.fillText("NOMINAL PENGELUARAN CASH FISIK",400,180);

  ctx.fillStyle="#ffffff";
  ctx.font="900 58px system-ui,sans-serif";
  ctx.fillText(`Rp${rupiah(nominal)}`,400,245);

  ctx.fillStyle="#140609";
  ctx.fillRect(70,285,660,200);
  ctx.strokeStyle="#4a1523";
  ctx.lineWidth=1.5;
  ctx.strokeRect(70,285,660,200);

  ctx.textAlign="left";
  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("WAKTU PENGELUARAN",100,325);
  ctx.fillStyle="#fffef5";
  ctx.font="16px system-ui,sans-serif";
  ctx.fillText(`${dateStr} • ${timeStr} WIB`,100,350);

  ctx.fillStyle="#a89f82";
  ctx.font="bold 14px system-ui,sans-serif";
  ctx.fillText("RINCIAN / KETERANGAN BELANJA",100,395);
  ctx.fillStyle="#fda4af";
  ctx.font="italic 16px system-ui,sans-serif";
  const noteText=note||"Biaya belanja/pengeluaran uang laci fisik kasir";
  ctx.fillText(noteText.length>55?noteText.slice(0,52)+"...":noteText,100,422);

  ctx.textAlign="center";
  ctx.fillStyle="#a89f82";
  ctx.font="12px system-ui,sans-serif";
  ctx.fillText("Dokumentasi Kas Keluar Fisik Laci Toko • Tidak Mengurangi Saldo QRIS Bank",400,535);

  return await canvasBlob(c,0.85);
}

function openExpenseModal(){
  if(e.expenseAmount)e.expenseAmount.value="";
  if(e.expenseNote)e.expenseNote.value="";
  if(e.expenseDate)e.expenseDate.value=localDate();
  if(e.expenseTime)e.expenseTime.value=currentJakartaTime();
  expenseSelectedBlob=null;
  if(e.expensePreviewWrap)e.expensePreviewWrap.classList.add("hidden");
  if(e.expensePreviewImg)e.expensePreviewImg.src="";
  if(e.expenseGalleryText)e.expenseGalleryText.textContent="Pilih Foto Nota dari Galeri";
  if(e.expenseFileInput)e.expenseFileInput.value="";
  if(e.expenseDialog){
    e.expenseDialog.showModal();
    setTimeout(()=>e.expenseAmount?.focus(),100);
  }
}

async function saveExpense(ev){
  ev.preventDefault();
  const expAmount=Number(e.expenseAmount.value.replace(/\D/g,""));
  if(!expAmount)return toast("Masukkan nominal pengeluaran yang valid", "warning");

  const expNote=(e.expenseNote.value||"").trim();
  if(!expNote)return toast("Keterangan belanja wajib diisi", "warning");

  const expDate=e.expenseDate.value||localDate();
  const expTime=e.expenseTime.value||currentJakartaTime();

  if(e.saveExpenseBtn){
    e.saveExpenseBtn.disabled=true;
    e.saveExpenseBtn.textContent="Menyimpan…";
  }

  // Jika sedang offline
  if(!navigator.onLine){
    let finalBlob=expenseSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateExpenseProofImage(expAmount,expNote,expDate,expTime);
    }
    await queueOfflineReceipt({
      amount: String(expAmount),
      isSurplus: false,
      isCashout: false,
      isRevised: false,
      isExpense: true,
      note: expNote,
      customDate: expDate,
      customTime: expTime,
      imageBlob: finalBlob
    });
    const line=formatReceiptLine(expTime,expAmount,false,false,false,expNote,true);
    e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
    if(e.expenseDialog)e.expenseDialog.close();
    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Struk cash disimpan di antrean offline", "warning");
    if(e.saveExpenseBtn){
      e.saveExpenseBtn.disabled=false;
      e.saveExpenseBtn.textContent="Simpan Struk Cash";
    }
    return;
  }

  try{
    let finalBlob=expenseSelectedBlob;
    if(!finalBlob){
      finalBlob=await generateExpenseProofImage(expAmount,expNote,expDate,expTime);
    }

    const fd=new FormData();
    fd.append("image",finalBlob,"nota-belanja.jpg");
    fd.append("amount",String(expAmount));
    fd.append("customDate",expDate);
    fd.append("customTime",expTime);
    fd.append("isExpense","true");
    fd.append("note",expNote);

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

    const line=formatReceiptLine(time,data.amount,false,false,false,data.note,true);
    e.shareText.textContent=`${line} gambar ${data.viewUrl || data.imageUrl}`;
    if(e.expenseDialog)e.expenseDialog.close();

    e.result.classList.add("hidden");
    e.success.classList.remove("hidden");
    e.success.scrollIntoView({behavior:"smooth"});
    toast("Struk belanja cash berhasil dicatat", "success");
  }catch(err){
    if(!navigator.onLine || err.message?.includes("fetch") || err.message?.includes("NetworkError")){
      let finalBlob=expenseSelectedBlob;
      if(!finalBlob){
        finalBlob=await generateExpenseProofImage(expAmount,expNote,expDate,expTime);
      }
      await queueOfflineReceipt({
        amount: String(expAmount),
        isSurplus: false,
        isCashout: false,
        isRevised: false,
        isExpense: true,
        note: expNote,
        customDate: expDate,
        customTime: expTime,
        imageBlob: finalBlob
      });
      const line=formatReceiptLine(expTime,expAmount,false,false,false,expNote,true);
      e.shareText.textContent=`${line} (Tersimpan Offline - Menunggu Sinkronisasi)`;
      if(e.expenseDialog)e.expenseDialog.close();
      e.result.classList.add("hidden");
      e.success.classList.remove("hidden");
      e.success.scrollIntoView({behavior:"smooth"});
      toast("Struk cash disimpan di antrean offline", "warning");
    } else {
      toast(err.message||"Gagal menyimpan struk cash");
    }
  }finally{
    if(e.saveExpenseBtn){
      e.saveExpenseBtn.disabled=false;
      e.saveExpenseBtn.textContent="Simpan Struk Cash";
    }
  }
}

function showPage(page){
  const h=page==="history";
  e.scanPage.classList.toggle("hidden",h);
  e.historyPage.classList.toggle("hidden",!h);
  e.scanTab.classList.toggle("active",!h);
  e.historyTab.classList.toggle("active",h);
  if(h){
    stopCamera();
    loadHistory();
  }else{
    if(e.result.classList.contains("hidden")&&e.success.classList.contains("hidden")){
      resumeLiveCamera();
    }
  }
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
  if(e.editIsExpense)e.editIsExpense.checked=Boolean(record.isExpense);
  if(e.editNote)e.editNote.value=record.note||"";
  
  if(e.editPinInput)e.editPinInput.value=sessionStorage.getItem("deletePin")||"";
  if(e.editDialog)e.editDialog.showModal();
}

async function handleSaveEdit(ev){
  ev.preventDefault();
  if(!pendingEditRecord)return;
  const newAmount=Number(e.editAmount.value.replace(/\D/g,""));
  if(!newAmount)return toast("Nominal rupiah tidak valid", "warning");
  const newDate=(e.editDate?.value||"").trim();
  if(!newDate)return toast("Tanggal transaksi wajib diisi", "warning");
  const newTime=(e.editTime?.value||"").trim();
  if(!newTime)return toast("Jam transaksi wajib diisi", "warning");
  const newIsSurplus=e.editIsSurplus?e.editIsSurplus.checked:false;
  const newIsCashout=e.editIsCashout?e.editIsCashout.checked:false;
  const newIsRevised=e.editIsRevised?e.editIsRevised.checked:false;
  const newIsExpense=e.editIsExpense?e.editIsExpense.checked:false;
  const newNote=(e.editNote?.value||"").trim();
  const pin=(e.editPinInput?.value||"").trim();
  if(!pin)return toast("PIN 6-digit wajib diisi", "warning");

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
        newIsSurplus,newIsCashout,newIsRevised,newIsExpense,
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
    toast("Perubahan transaksi berhasil disimpan", "success");
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
    return toast("Wajib mengisi PIN dan Password Admin", "warning");
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
    toast("Transaksi berhasil dihapus", "success");
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
        stopCamera();
        e.scanPage.classList.add("hidden");
        e.historyPage.classList.remove("hidden");
        e.scanTab.classList.remove("active");
        e.historyTab.classList.add("active");
      }
    }

    if(!data.records.length){
      e.historyEmpty.classList.remove("hidden");
      if(e.groupedTransactions)e.groupedTransactions.classList.add("hidden");
      return;
    }

    // Hitung total dan kelompokkan transaksi dengan nominal yang sama
    const groupMap=new Map();
    let total=0, salesTotal=0, surplusTotal=0, cashoutTotal=0, revisedCount=0, expenseTotal=0, expenseCount=0;
    const lines=[],links=[],expenseLines=[],expenseLinks=[];
    for(const [index,r] of data.records.entries()){
      // Skip pending records (belum dikonfirmasi nominalnya)
      if(r.isPending) continue;

      const isSurplus=Boolean(r.isSurplus);
      const isCashout=Boolean(r.isCashout);
      const isRevised=Boolean(r.isRevised);
      const isExpense=Boolean(r.isExpense);

      if(isExpense){
        expenseTotal+=r.amount;
        expenseCount++;
      }else{
        total+=r.amount;
        if(isSurplus){
          surplusTotal+=r.amount;
        }else if(isCashout){
          cashoutTotal+=r.amount;
        }else{
          salesTotal+=r.amount;
        }
      }

      if(isRevised){
        revisedCount++;
      }

      const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(r.savedAt));
      const line=formatReceiptLine(time,r.amount,isSurplus,isCashout,isRevised,r.note,isExpense);
      const recapLine=loadSettings().recapCompact?formatReceiptLineCompact(time,r.amount,isSurplus,isCashout,isRevised,r.note,isExpense):line;

      const recordWebLink = r.viewUrl || r.imageUrl;

      if(isExpense){
        expenseLines.push(`• ${recapLine}`);
        expenseLinks.push(`• Nota Cash: ${recordWebLink}`);
      }else{
        lines.push(`${lines.length+1}. ${recapLine}`);
        links.push(`${links.length+1}. ${recordWebLink}`);

        if(!isSurplus && !isCashout){
          if(!groupMap.has(r.amount)){
            groupMap.set(r.amount,{amount:r.amount,count:0,total:0,times:[]});
          }
          const g=groupMap.get(r.amount);
          g.count++;
          g.total+=r.amount;
          g.times.push(time);
        }
      }

      const item=document.createElement("article");
      item.className=`history-item${isExpense?" is-expense":""}${isSurplus?" is-surplus":""}${isCashout?" is-cashout":""}${isRevised?" is-revised":""}`;
      
      const expenseBadgeHtml=isExpense?`<span class="badge-expense"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>STRUK CASH</span></span>`:"";
      const surplusBadgeHtml=isSurplus?`<span class="badge-surplus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><span>SURPLUS</span></span>`:"";
      const cashoutBadgeHtml=isCashout?`<span class="badge-cashout"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg><span>TUKAR CASH</span></span>`:"";
      const revisedBadgeHtml=isRevised?`<span class="badge-revised"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg><span>REVISI</span></span>`:"";

      const safeNote=escapeHtml(r.note);
      const noteHtml=r.note?`<div class="history-item-note" title="${safeNote}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>${safeNote}</span></div>`:"";
      const adminActionsHtml=data.role==="admin"?`<button class="edit-record" type="button" aria-label="Edit transaksi">Edit</button><button class="delete-record" type="button" aria-label="Hapus transaksi">Hapus</button>`:"";

      item.innerHTML=`<img class="history-item-thumb" src="${r.imageUrl}" alt="Bukti ${isExpense?"Struk Belanja Cash":isSurplus?"Surplus":isCashout?"Tukar Cash":"QRIS"}" loading="lazy"><div class="history-item-body"><div class="history-item-header"><div class="history-item-meta"><time class="history-item-time">${time} WIB</time>${expenseBadgeHtml}${surplusBadgeHtml}${cashoutBadgeHtml}${revisedBadgeHtml}</div><div class="history-item-actions"><button class="copy-record" type="button" title="Salin transaksi ini">Salin</button>${adminActionsHtml}</div></div><strong class="history-item-amount">${isExpense?"-":""}Rp${rupiah(r.amount)}</strong>${noteHtml}<a class="history-item-link" href="${recordWebLink}" target="_blank" rel="noopener"><span>Lihat foto bukti</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>`;

      const previewMeta = {
        title: isExpense ? "Nota Belanja Cash" : isSurplus ? "Bukti Surplus Kas" : isCashout ? "Bukti Tukar Cash" : isRevised ? "Bukti Transaksi Revisi" : "Bukti Pembayaran QRIS",
        amount: r.amount,
        time: time,
        date: r.date,
        isExpense: isExpense,
        badgeLabel: isExpense ? "STRUK CASH" : isSurplus ? "SURPLUS" : isCashout ? "TUKAR CASH" : isRevised ? "REVISI" : "QRIS",
        badgeClass: isExpense ? "badge-expense" : isSurplus ? "badge-surplus" : isCashout ? "badge-cashout" : isRevised ? "badge-revised" : "",
        note: r.note,
        viewUrl: r.viewUrl,
        rawViewUrl: r.rawViewUrl,
        imageKey: r.imageKey
      };

      const thumbEl = item.querySelector(".history-item-thumb");
      if (thumbEl) {
        thumbEl.onclick = (ev) => {
          ev.preventDefault();
          openImagePreview(r.viewUrl || r.imageUrl, previewMeta);
        };
      }
      const linkEl = item.querySelector(".history-item-link");
      if (linkEl) {
        linkEl.onclick = (ev) => {
          ev.preventDefault();
          if (loadSettings().imagePreviewMode === "browser") {
            window.open(r.viewUrl || r.imageUrl, "_blank");
          } else {
            openImagePreview(r.viewUrl || r.imageUrl, previewMeta);
          }
        };
      }

      item.querySelector(".copy-record").onclick=async()=>{
        await navigator.clipboard.writeText(`${line} gambar ${recordWebLink}`);
        toast("Rincian transaksi & link web berhasil disalin", "success");
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
        toast("Ringkasan nominal berhasil disalin", "success");
      };
    }

    const compact=s.recapCompact;
    const recapBreakdown=[];
    if(compact){
      recapBreakdown.push(`*Penjualan: Rp${rupiah(salesTotal)}*`);
      if(cashoutTotal>0)recapBreakdown.push(`*Tukar: -Rp${rupiah(cashoutTotal)}*`);
      if(surplusTotal>0)recapBreakdown.push(`*Surplus: +Rp${rupiah(surplusTotal)}*`);
      recapBreakdown.push(`*Total QRIS: Rp${rupiah(total)}*`);
      if(revisedCount>0)recapBreakdown.push(`_${revisedCount} revisi_`);
    }else{
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
    }

    let expenseRecapText="";
    if(expenseCount>0){
      expenseRecapText=compact
        ?`\n\n*Belanja Cash (${expenseCount} nota): Rp${rupiah(expenseTotal)}*\n${expenseLines.join("\n")}\n\nNota:\n${expenseLinks.join("\n")}`
        :`\n\n*--- DOKUMENTASI STRUK BELANJA CASH (LACI FISIK) ---*\n${expenseLines.map(l=>l.replace(/^• /,"• [CASH] ")).join("\n")}\n*Total Belanja Cash: Rp${rupiah(expenseTotal)} (${expenseCount} nota)*\n_(Biaya pengeluaran cash kasir, murni arsip & tidak memotong saldo QRIS bank)_\n\nFoto Nota Belanja:\n${expenseLinks.join("\n")}`;
    }

    recapText=compact
      ?`*REKAP QRIS ${titleDate(date)}*\n\n${lines.join("\n")}${groupedSummaryText}\n\n${recapBreakdown.join("\n")}\n\nBukti:\n${links.join("\n")}${expenseRecapText}`
      :`*REKAP TRANSAKSI QRIS (${titleDate(date)})*\n\n${lines.join("\n")}${groupedSummaryText}\n\n${recapBreakdown.join("\n")}\n\nLink bukti:\n${links.join("\n")}${expenseRecapText}`;
    if(e.recapSalesTotal)e.recapSalesTotal.textContent=`Rp${rupiah(salesTotal)}`;
    if(e.recapSurplusTotal)e.recapSurplusTotal.textContent=`+Rp${rupiah(surplusTotal)}`;
    if(e.recapCashoutTotal)e.recapCashoutTotal.textContent=`-Rp${rupiah(cashoutTotal)}`;
    if(e.recapRevisedCount)e.recapRevisedCount.textContent=`${revisedCount} trx`;
    if(e.historyTotal)e.historyTotal.textContent=`Rp${rupiah(total)}`;

    if(e.recapExpenseSection){
      if(expenseCount>0){
        e.recapExpenseSection.style.display="block";
        if(e.recapExpenseCount)e.recapExpenseCount.textContent=`${expenseCount} nota`;
        if(e.recapExpenseTotal)e.recapExpenseTotal.textContent=`Rp${rupiah(expenseTotal)}`;
      }else{
        e.recapExpenseSection.style.display="none";
      }
    }

    const hasSpecialRows=surplusTotal>0||cashoutTotal>0||revisedCount>0;
    if(e.recapSurplusRow)e.recapSurplusRow.style.display=surplusTotal>0?"flex":"none";
    if(e.recapCashoutRow)e.recapCashoutRow.style.display=cashoutTotal>0?"flex":"none";
    if(e.recapRevisedRow)e.recapRevisedRow.style.display=revisedCount>0?"flex":"none";
    if(e.recapDivider)e.recapDivider.style.display=hasSpecialRows?"block":"none";

    e.recapBox.classList.remove("hidden");
  }catch(x){toast(x.message||"Gagal memuat riwayat transaksi", "error");}
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
      toast(`Pembersihan selesai: ${data.deletedRecords||0} catatan dan ${data.deletedImages||0} foto lama dibersihkan`, "success");
    }catch(err){
      toast(err.message||"Gagal melakukan pembersihan");
    }finally{
      e.cleanNowBtn.disabled=false;
      e.cleanNowBtn.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg><span>Bersihkan Data Kadaluarsa Sekarang</span>`;
    }
  };
}

e.startCamera.onclick=()=>startCamera();
e.capture.onclick=captureFromCamera;
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

  if(e.manualIsExpense && e.manualIsExpense.checked){
    isExpenseMode=true;
    isSurplusMode=false;
    isCashoutMode=false;
    currentNote=(e.manualExpenseNote?.value||"").trim();
  } else if(e.manualIsSurplus && e.manualIsSurplus.checked){
    isSurplusMode=true;
    isCashoutMode=false;
    isExpenseMode=false;
    currentNote=(e.manualNote?.value||"").trim();
  } else if(e.manualIsCashout && e.manualIsCashout.checked){
    isCashoutMode=true;
    isSurplusMode=false;
    isExpenseMode=false;
    currentNote=(e.manualCashoutNote?.value||"").trim();
  } else {
    isSurplusMode=false;
    isCashoutMode=false;
    isExpenseMode=false;
    currentNote="";
  }

  if(e.manualIsRevised){
    isRevisedMode=e.manualIsRevised.checked;
  }

  if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.toggle("hidden",!isSurplusMode);
  if(e.confirmCashoutBadge)e.confirmCashoutBadge.classList.toggle("hidden",!isCashoutMode);
  updateRevisedToggleUI();
  updateExpenseToggleUI();

  if(e.confirmNoteDisplay){
    if((isSurplusMode||isCashoutMode||isExpenseMode) && currentNote){
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
      if(e.manualIsExpense){
        e.manualIsExpense.checked=false;
        if(e.manualExpenseNoteWrap)e.manualExpenseNoteWrap.style.display="none";
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
      if(e.manualIsExpense){
        e.manualIsExpense.checked=false;
        if(e.manualExpenseNoteWrap)e.manualExpenseNoteWrap.style.display="none";
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

if(e.manualIsExpense){
  e.manualIsExpense.onchange=()=>{
    if(e.manualIsExpense.checked){
      if(e.manualIsSurplus){
        e.manualIsSurplus.checked=false;
        if(e.manualNoteWrap)e.manualNoteWrap.style.display="none";
      }
      if(e.manualIsCashout){
        e.manualIsCashout.checked=false;
        if(e.manualCashoutNoteWrap)e.manualCashoutNoteWrap.style.display="none";
      }
      if(e.manualExpenseNoteWrap){
        e.manualExpenseNoteWrap.style.display="block";
        if(e.manualExpenseNote)setTimeout(()=>e.manualExpenseNote.focus(),100);
      }
    }else{
      if(e.manualExpenseNoteWrap)e.manualExpenseNoteWrap.style.display="none";
    }
  };
}

if(e.editIsSurplus){
  e.editIsSurplus.onchange=()=>{
    if(e.editIsSurplus.checked){
      if(e.editIsCashout) e.editIsCashout.checked=false;
      if(e.editIsExpense) e.editIsExpense.checked=false;
    }
  };
}

if(e.editIsCashout){
  e.editIsCashout.onchange=()=>{
    if(e.editIsCashout.checked){
      if(e.editIsSurplus) e.editIsSurplus.checked=false;
      if(e.editIsExpense) e.editIsExpense.checked=false;
    }
  };
}

if(e.editIsExpense){
  e.editIsExpense.onchange=()=>{
    if(e.editIsExpense.checked){
      if(e.editIsSurplus) e.editIsSurplus.checked=false;
      if(e.editIsCashout) e.editIsCashout.checked=false;
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

if(e.openRevisedBtn) e.openRevisedBtn.onclick=openRevisedModal;
if(e.saveRevisedBtn) e.saveRevisedBtn.onclick=saveRevised;

if(e.revisedAmount){
  e.revisedAmount.oninput=()=>{
    const d=e.revisedAmount.value.replace(/\D/g,"");
    e.revisedAmount.value=d?rupiah(Number(d)):"";
  };
}

if(e.revisedFileInput){
  e.revisedFileInput.onchange=()=>{
    const f=e.revisedFileInput.files[0];
    if(!f)return;
    const img=new Image();
    img.onload=async()=>{
      const w=img.naturalWidth,h=img.naturalHeight,max=1100,z=Math.min(1,max/w);
      e.canvas.width=Math.round(w*z);
      e.canvas.height=Math.round(h*z);
      e.canvas.getContext("2d").drawImage(img,0,0,e.canvas.width,e.canvas.height);
      revisedSelectedBlob=await canvasBlob(e.canvas);
      if(e.revisedPreviewImg)e.revisedPreviewImg.src=URL.createObjectURL(revisedSelectedBlob);
      if(e.revisedPreviewWrap)e.revisedPreviewWrap.classList.remove("hidden");
      if(e.revisedGalleryText)e.revisedGalleryText.textContent="Ganti Foto Bukti Galeri";
      URL.revokeObjectURL(img.src);
    };
    img.src=URL.createObjectURL(f);
  };
}

if(e.removeRevisedPhoto){
  e.removeRevisedPhoto.onclick=()=>{
    revisedSelectedBlob=null;
    if(e.revisedPreviewWrap)e.revisedPreviewWrap.classList.add("hidden");
    if(e.revisedPreviewImg)e.revisedPreviewImg.src="";
    if(e.revisedGalleryText)e.revisedGalleryText.textContent="Pilih Foto Bukti dari Galeri";
    if(e.revisedFileInput)e.revisedFileInput.value="";
  };
}

if(e.openExpenseBtn) e.openExpenseBtn.onclick=openExpenseModal;
if(e.saveExpenseBtn) e.saveExpenseBtn.onclick=saveExpense;

if(e.expenseAmount){
  e.expenseAmount.oninput=()=>{
    const d=e.expenseAmount.value.replace(/\D/g,"");
    e.expenseAmount.value=d?rupiah(Number(d)):"";
  };
}

if(e.expenseFileInput){
  e.expenseFileInput.onchange=()=>{
    const f=e.expenseFileInput.files[0];
    if(!f)return;
    const img=new Image();
    img.onload=async()=>{
      const w=img.naturalWidth,h=img.naturalHeight,max=1100,z=Math.min(1,max/w);
      e.canvas.width=Math.round(w*z);
      e.canvas.height=Math.round(h*z);
      e.canvas.getContext("2d").drawImage(img,0,0,e.canvas.width,e.canvas.height);
      expenseSelectedBlob=await canvasBlob(e.canvas);
      if(e.expensePreviewImg)e.expensePreviewImg.src=URL.createObjectURL(expenseSelectedBlob);
      if(e.expensePreviewWrap)e.expensePreviewWrap.classList.remove("hidden");
      if(e.expenseGalleryText)e.expenseGalleryText.textContent="Ganti Foto Nota Galeri";
      URL.revokeObjectURL(img.src);
    };
    img.src=URL.createObjectURL(f);
  };
}

if(e.removeExpensePhoto){
  e.removeExpensePhoto.onclick=()=>{
    expenseSelectedBlob=null;
    if(e.expensePreviewWrap)e.expensePreviewWrap.classList.add("hidden");
    if(e.expensePreviewImg)e.expensePreviewImg.src="";
    if(e.expenseGalleryText)e.expenseGalleryText.textContent="Pilih Foto Nota dari Galeri";
    if(e.expenseFileInput)e.expenseFileInput.value="";
  };
}

if(e.toggleConfirmRevisedBtn){
  e.toggleConfirmRevisedBtn.onclick=()=>{
    isRevisedMode=!isRevisedMode;
    if(e.manualIsRevised) e.manualIsRevised.checked=isRevisedMode;
    updateRevisedToggleUI();
    toast(isRevisedMode?"Label Revisi diaktifkan":"Label Revisi dinonaktifkan");
  };
}

if(e.toggleConfirmExpenseBtn){
  e.toggleConfirmExpenseBtn.onclick=()=>{
    isExpenseMode=!isExpenseMode;
    if(isExpenseMode){
      isSurplusMode=false;
      isCashoutMode=false;
      if(e.confirmSurplusBadge)e.confirmSurplusBadge.classList.add("hidden");
      if(e.confirmCashoutBadge)e.confirmCashoutBadge.classList.add("hidden");
      if(e.manualIsSurplus)e.manualIsSurplus.checked=false;
      if(e.manualIsCashout)e.manualIsCashout.checked=false;
      if(e.manualIsExpense)e.manualIsExpense.checked=true;
    }else{
      if(e.manualIsExpense)e.manualIsExpense.checked=false;
    }
    updateExpenseToggleUI();
    toast(isExpenseMode?"Ditandai sebagai Struk Belanja Cash (Laci)":"Mode Struk Cash dinonaktifkan (QRIS)");
  };
}

e.share.onclick=()=>shareText(e.shareText.textContent);
e.copy.onclick=async()=>{await navigator.clipboard.writeText(e.shareText.textContent);toast("Teks struk berhasil disalin","success");};
e.shareRecap.onclick=()=>shareText(recapText);
e.copyRecap.onclick=async()=>{await navigator.clipboard.writeText(recapText);toast("Rekap harian berhasil disalin","success");};
if(e.editAmount){
  e.editAmount.oninput=()=>{const d=e.editAmount.value.replace(/\D/g,"");e.editAmount.value=d?rupiah(Number(d)):"";};
}
if(e.saveEditBtn) e.saveEditBtn.onclick=handleSaveEdit;

// === PENDING EVENT LISTENERS ===
if(e.openPendingBtn) e.openPendingBtn.onclick=openPendingDialog;
if(e.closePendingBtn) e.closePendingBtn.onclick=()=>{ if(e.pendingDialog) e.pendingDialog.close(); };
if(e.refreshPendingBtn) e.refreshPendingBtn.onclick=loadPendingList;
if(e.savePendingConfirmBtn) e.savePendingConfirmBtn.onclick=handleSavePendingConfirm;
if(e.cancelPendingConfirmBtn) e.cancelPendingConfirmBtn.onclick=()=>{ if(e.pendingConfirmDialog) e.pendingConfirmDialog.close(); };
const pendingConfirmForm = document.getElementById("pendingConfirmForm");
if(pendingConfirmForm) pendingConfirmForm.onsubmit=handleSavePendingConfirm;
if(e.pendingConfirmAmount){
  e.pendingConfirmAmount.oninput=()=>{
    const d=e.pendingConfirmAmount.value.replace(/\D/g,"");
    e.pendingConfirmAmount.value=d?rupiah(Number(d)):"";
  };
}
if(e.pendingConfirmIsSurplus){
  e.pendingConfirmIsSurplus.onchange=()=>{
    if(e.pendingConfirmIsSurplus.checked){
      if(e.pendingConfirmIsCashout) e.pendingConfirmIsCashout.checked=false;
      if(e.pendingConfirmIsExpense) e.pendingConfirmIsExpense.checked=false;
    }
  };
}
if(e.pendingConfirmIsCashout){
  e.pendingConfirmIsCashout.onchange=()=>{
    if(e.pendingConfirmIsCashout.checked){
      if(e.pendingConfirmIsSurplus) e.pendingConfirmIsSurplus.checked=false;
      if(e.pendingConfirmIsExpense) e.pendingConfirmIsExpense.checked=false;
    }
  };
}
if(e.pendingConfirmIsExpense){
  e.pendingConfirmIsExpense.onchange=()=>{
    if(e.pendingConfirmIsExpense.checked){
      if(e.pendingConfirmIsSurplus) e.pendingConfirmIsSurplus.checked=false;
      if(e.pendingConfirmIsCashout) e.pendingConfirmIsCashout.checked=false;
    }
  };
}

// Inisialisasi awal pengaturan & kamera secara paralel (instan, tidak menunggu request API riwayat)
applySettingsUI(loadSettings());
if(isSecureContext() && "mediaDevices" in navigator){
  startCamera();
  getAllVideoInputDevices(true).catch(()=>{});
}
e.historyDate.value=localDate();
loadHistory(true);
updatePendingBadge();

// === NATIVE ANDROID HARDWARE CAMERA BRIDGE CALLBACK (Persis DStock) ===
window.onHardwareCameraCapture = function(dataUrl) {
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    useSource(img, "native_camera");
    toast("Foto kamera berhasil dimuat", "success");
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
          fd.append("isExpense", String(Boolean(it.isExpense)));
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
      toast("Sinkronisasi transaksi offline selesai", "success");
      if (!e.historyPage.classList.contains("hidden")) {
        loadHistory();
      }
    };
  } catch (err) {
    console.warn("Offline sync error:", err);
  }
}


// ==================== IN-APP EXPANSIVE IMAGE PREVIEW ====================
let currentPreviewUrl = "";
let currentViewUrl = "";
let currentImageKey = "";
let previewScale = 1;
let previewRotation = 0;
let previewPanX = 0;
let previewPanY = 0;
let isPreviewDragging = false;
let previewStartX = 0;
let previewStartY = 0;

function updatePreviewTransform() {
  if (!e.imagePreviewModalImg) return;
  e.imagePreviewModalImg.style.transform = `translate(${previewPanX}px, ${previewPanY}px) scale(${previewScale}) rotate(${previewRotation}deg)`;
  if (e.imagePreviewZoomBadge) {
    e.imagePreviewZoomBadge.textContent = `${Math.round(previewScale * 100)}%`;
    e.imagePreviewZoomBadge.classList.toggle("hidden", previewScale === 1 && previewRotation === 0);
  }
  if (e.imagePreviewFrame) {
    e.imagePreviewFrame.style.cursor = previewScale > 1 ? (isPreviewDragging ? "grabbing" : "grab") : "default";
  }
}

function resetPreviewTransform() {
  previewScale = 1;
  previewRotation = 0;
  previewPanX = 0;
  previewPanY = 0;
  isPreviewDragging = false;
  updatePreviewTransform();
}

async function getOrFetchViewUrl() {
  if (currentViewUrl) return currentViewUrl;
  if (!currentPreviewUrl) return "";
  if (currentPreviewUrl.startsWith("blob:") || currentPreviewUrl.startsWith("data:")) {
    return "";
  }
  let key = currentImageKey;
  if (!key) {
    const keyMatch = currentPreviewUrl.match(/images\/\d{4}\/\d{2}\/\d{2}\/[^?#]+/);
    if (keyMatch) key = keyMatch[0];
  }
  if (key) {
    try {
      const res = await fetch(`/api/share-token?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.viewUrl) {
          currentViewUrl = data.viewUrl;
          return currentViewUrl;
        }
      }
    } catch (_) {}
  }
  return currentPreviewUrl;
}

function openImagePreview(url, meta = {}) {
  if (!url) return;
  const isMobile = isMobileApp();
  const s = loadSettings();

  // Eksklusif untuk mobile Android DAN harus dinyalakan di pengaturan.
  // Jika di browser web atau di mobile tapi setting belum diaktifkan:
  // langsung buka Web Viewer di tab baru dengan token expired.
  if (!isMobile || s.imagePreviewMode !== "in_app") {
    const targetUrl = meta.viewUrl || url;
    window.open(targetUrl, "_blank");
    return;
  }
  currentPreviewUrl = url;
  currentViewUrl = meta.viewUrl || "";
  currentImageKey = meta.imageKey || "";
  resetPreviewTransform();

  if (e.imagePreviewModalImg) {
    e.imagePreviewModalImg.src = url;
  }
  if (e.imagePreviewTitle) {
    e.imagePreviewTitle.textContent = meta.title || "Foto Bukti Transaksi";
  }
  if (e.imagePreviewSubtitle) {
    const parts = [];
    if (meta.time) parts.push(meta.time + " WIB");
    if (meta.date) parts.push(meta.date);
    e.imagePreviewSubtitle.textContent = parts.join(" • ") || "Dokumentasi Struk Digital";
  }
  if (e.imagePreviewMeta) {
    let chips = "";
    if (meta.amount) {
      const isExp = meta.isExpense;
      chips += `<span class="badge-preview-amount">${isExp ? "-" : ""}Rp${rupiah(meta.amount)}</span>`;
    }
    if (meta.badgeLabel) {
      chips += `<span class="badge-preview-type ${meta.badgeClass || ''}">${escapeHtml(meta.badgeLabel)}</span>`;
    }
    if (meta.note) {
      chips += `<span class="badge-preview-note">${escapeHtml(meta.note)}</span>`;
    }
    if (currentViewUrl) {
      chips += `<span class="badge-preview-exp"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Tautan Web Aman (48 Jam)</span>`;
    }
    e.imagePreviewMeta.innerHTML = chips;
    e.imagePreviewMeta.style.display = chips ? "flex" : "none";
  }
  if (e.imagePreviewDialog) {
    e.imagePreviewDialog.showModal();
  }
}

if (e.imagePreviewCloseBtn) {
  e.imagePreviewCloseBtn.addEventListener("click", () => {
    if (e.imagePreviewDialog) e.imagePreviewDialog.close();
  });
}

if (e.imagePreviewDialog) {
  e.imagePreviewDialog.addEventListener("click", (ev) => {
    if (ev.target === e.imagePreviewDialog) {
      e.imagePreviewDialog.close();
    }
  });
}

if (e.imagePreviewFrame) {
  let touchStartDist = 0;
  let initialTouchScale = 1;
  let lastTapTime = 0;

  // Wheel zoom (Desktop/mouse)
  e.imagePreviewFrame.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    if (ev.deltaY < 0) previewScale = Math.min(4, previewScale + 0.2);
    else previewScale = Math.max(1, previewScale - 0.2);
    if (previewScale <= 1) { previewPanX = 0; previewPanY = 0; }
    updatePreviewTransform();
  }, { passive: false });

  // Mouse Drag (Desktop)
  e.imagePreviewFrame.addEventListener("mousedown", (ev) => {
    if (previewScale <= 1) return;
    isPreviewDragging = true;
    previewStartX = ev.clientX - previewPanX;
    previewStartY = ev.clientY - previewPanY;
    if (e.imagePreviewFrame) e.imagePreviewFrame.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (ev) => {
    if (!isPreviewDragging) return;
    previewPanX = ev.clientX - previewStartX;
    previewPanY = ev.clientY - previewStartY;
    updatePreviewTransform();
  });

  window.addEventListener("mouseup", () => {
    if (isPreviewDragging) {
      isPreviewDragging = false;
      updatePreviewTransform();
    }
  });

  // Touch: Pinch-to-zoom (Cubit Layar) & Pan (Geser)
  e.imagePreviewFrame.addEventListener("touchstart", (ev) => {
    if (ev.touches.length === 2) {
      ev.preventDefault();
      touchStartDist = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY
      );
      initialTouchScale = previewScale;
      isPreviewDragging = false;
    } else if (ev.touches.length === 1 && previewScale > 1) {
      isPreviewDragging = true;
      previewStartX = ev.touches[0].clientX - previewPanX;
      previewStartY = ev.touches[0].clientY - previewPanY;
    }
  }, { passive: false });

  e.imagePreviewFrame.addEventListener("touchmove", (ev) => {
    if (ev.touches.length === 2 && touchStartDist > 0) {
      ev.preventDefault();
      const dist = Math.hypot(
        ev.touches[0].clientX - ev.touches[1].clientX,
        ev.touches[0].clientY - ev.touches[1].clientY
      );
      previewScale = Math.min(4, Math.max(1, initialTouchScale * (dist / touchStartDist)));
      if (previewScale <= 1) {
        previewPanX = 0;
        previewPanY = 0;
      }
      updatePreviewTransform();
    } else if (ev.touches.length === 1 && isPreviewDragging) {
      ev.preventDefault();
      previewPanX = ev.touches[0].clientX - previewStartX;
      previewPanY = ev.touches[0].clientY - previewStartY;
      updatePreviewTransform();
    }
  }, { passive: false });

  e.imagePreviewFrame.addEventListener("touchend", (ev) => {
    isPreviewDragging = false;
    touchStartDist = 0;
    if (previewScale <= 1.05) {
      resetPreviewTransform();
    }

    // Ketuk 2x (double-tap) untuk zoom cepat (toggle 1x dan 2.5x)
    const now = Date.now();
    if (now - lastTapTime < 280 && ev.touches.length === 0) {
      if (previewScale > 1.1) {
        resetPreviewTransform();
      } else {
        previewScale = 2.5;
        updatePreviewTransform();
      }
    }
    lastTapTime = now;
  });

  // Double click for mouse
  e.imagePreviewFrame.addEventListener("dblclick", () => {
    if (previewScale > 1.1) {
      resetPreviewTransform();
    } else {
      previewScale = 2.5;
      updatePreviewTransform();
    }
  });
}

window.addEventListener("keydown", (ev) => {
  if (e.imagePreviewDialog && e.imagePreviewDialog.open) {
    if (ev.key === "Escape") {
      e.imagePreviewDialog.close();
    } else if (ev.key === "+" || ev.key === "=") {
      ev.preventDefault();
      previewScale = Math.min(4, previewScale + 0.3);
      updatePreviewTransform();
    } else if (ev.key === "-") {
      ev.preventDefault();
      previewScale = Math.max(1, previewScale - 0.3);
      if (previewScale <= 1) { previewPanX = 0; previewPanY = 0; }
      updatePreviewTransform();
    } else if (ev.key === "0") {
      ev.preventDefault();
      resetPreviewTransform();
    }
  }
});




// Unified click preview for all image thumbnails across the app
if (e.preview) {
  e.preview.style.cursor = "pointer";
  e.preview.title = "Klik untuk memperbesar pratinjau foto";
  e.preview.addEventListener("click", () => {
    if (e.preview.src) {
      openImagePreview(e.preview.src, {
        title: "Pratinjau Hasil Foto",
        time: e.displayTime?.value || "",
        date: e.displayDate?.value || "",
        amount: amount || B,
        isExpense: isExpenseMode,
        badgeLabel: isExpenseMode ? "STRUK CASH" : isSurplusMode ? "SURPLUS" : isCashoutMode ? "TUKAR CASH" : isRevisedMode ? "REVISI" : "QRIS",
        badgeClass: isExpenseMode ? "badge-expense" : isSurplusMode ? "badge-surplus" : isCashoutMode ? "badge-cashout" : isRevisedMode ? "badge-revised" : "",
        note: currentNote || h
      });
    }
  });
}

if (e.surplusPreviewImg) {
  e.surplusPreviewImg.style.cursor = "pointer";
  e.surplusPreviewImg.title = "Klik untuk memperbesar foto bukti";
  e.surplusPreviewImg.addEventListener("click", () => {
    if (e.surplusPreviewImg.src) {
      openImagePreview(e.surplusPreviewImg.src, {
        title: "Pratinjau Bukti Surplus",
        amount: Number((e.surplusAmount?.value || "").replace(/\D/g, "")) || 0,
        badgeLabel: "SURPLUS",
        badgeClass: "badge-surplus",
        note: e.surplusNote?.value || ""
      });
    }
  });
}

if (e.cashoutPreviewImg) {
  e.cashoutPreviewImg.style.cursor = "pointer";
  e.cashoutPreviewImg.title = "Klik untuk memperbesar foto bukti";
  e.cashoutPreviewImg.addEventListener("click", () => {
    if (e.cashoutPreviewImg.src) {
      openImagePreview(e.cashoutPreviewImg.src, {
        title: "Pratinjau Bukti Tukar Cash",
        amount: Number((e.cashoutAmount?.value || "").replace(/\D/g, "")) || 0,
        badgeLabel: "TUKAR CASH",
        badgeClass: "badge-cashout",
        note: e.cashoutNote?.value || ""
      });
    }
  });
}

if (e.revisedPreviewImg) {
  e.revisedPreviewImg.style.cursor = "pointer";
  e.revisedPreviewImg.title = "Klik untuk memperbesar foto bukti";
  e.revisedPreviewImg.addEventListener("click", () => {
    if (e.revisedPreviewImg.src) {
      openImagePreview(e.revisedPreviewImg.src, {
        title: "Pratinjau Bukti Revisi",
        amount: Number((e.revisedAmount?.value || "").replace(/\D/g, "")) || 0,
        badgeLabel: "REVISI",
        badgeClass: "badge-revised",
        note: e.revisedNote?.value || ""
      });
    }
  });
}

if (e.expensePreviewImg) {
  e.expensePreviewImg.style.cursor = "pointer";
  e.expensePreviewImg.title = "Klik untuk memperbesar foto bukti";
  e.expensePreviewImg.addEventListener("click", () => {
    if (e.expensePreviewImg.src) {
      openImagePreview(e.expensePreviewImg.src, {
        title: "Pratinjau Nota Belanja Cash",
        amount: Number((e.expenseAmount?.value || "").replace(/\D/g, "")) || 0,
        isExpense: true,
        badgeLabel: "STRUK CASH",
        badgeClass: "badge-expense",
        note: e.expenseNote?.value || ""
      });
    }
  });
}

// ==================== WEB APP INSTALL BANNER & LATEST RELEASE ====================
let deferredInstallPrompt = null;
const FALLBACK_APK_URL = "https://github.com/Ramadani1t/QRISKas/releases/latest/download/qriskas-release.apk";

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  deferredInstallPrompt = ev;
  if (e.webInstallPwaBtn) {
    e.webInstallPwaBtn.classList.remove("hidden");
  }
  checkAndDisplayWebInstallBanner();
});

if (e.webInstallPwaBtn) {
  e.webInstallPwaBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      if (e.webInstallBanner) e.webInstallBanner.classList.add("hidden");
      toast("Aplikasi sedang dipasang", "success");
    }
    deferredInstallPrompt = null;
  });
}

if (e.dismissInstallBannerBtn) {
  e.dismissInstallBannerBtn.addEventListener("click", () => {
    if (e.webInstallBanner) e.webInstallBanner.classList.add("hidden");
    sessionStorage.setItem("dismissedInstallBanner", "1");
  });
}

async function fetchLatestGitHubReleaseMeta() {
  try {
    const cached = localStorage.getItem("cachedReleaseMeta");
    const cachedTime = Number(localStorage.getItem("cachedReleaseMetaTime") || 0);
    if (cached && (Date.now() - cachedTime < 3600000 * 4)) {
      applyReleaseMeta(JSON.parse(cached));
      return;
    }
    const res = await fetch("https://api.github.com/repos/Ramadani1t/QRISKas/releases/latest");
    if (!res.ok) return;
    const data = await res.json();
    let apkUrl = FALLBACK_APK_URL;
    let apkSize = 0;
    if (Array.isArray(data.assets)) {
      const apkAsset = data.assets.find(a => (a.name || "").endsWith(".apk"));
      if (apkAsset) {
        apkUrl = apkAsset.browser_download_url;
        apkSize = apkAsset.size;
      }
    }
    const releaseMeta = {
      tag_name: data.tag_name || "v1.2.0",
      name: data.name || "QRIS Kas",
      body: data.body || "",
      apkUrl,
      apkSize
    };
    localStorage.setItem("cachedReleaseMeta", JSON.stringify(releaseMeta));
    localStorage.setItem("cachedReleaseMetaTime", String(Date.now()));
    applyReleaseMeta(releaseMeta);
  } catch (_) {}
}

function applyReleaseMeta(meta) {
  if (!meta) return;
  if (e.webInstallVersionBadge && meta.tag_name) {
    e.webInstallVersionBadge.textContent = meta.tag_name;
  }
  if (e.webInstallApkBtn && meta.apkUrl) {
    e.webInstallApkBtn.href = meta.apkUrl;
  }
  if (e.webInstallApkBtnText && meta.tag_name) {
    e.webInstallApkBtnText.textContent = `Unduh APK (${meta.tag_name})`;
  }
}

function checkAndDisplayWebInstallBanner() {
  const isAndroidApp = Boolean(window.__isAndroidApp || window.QriskasAndroid || window.AndroidBridge);
  const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
  if (isAndroidApp || isStandalone) return;

  const s = loadSettings();
  if (s.installBannerEnabled === false) return;
  if (sessionStorage.getItem("dismissedInstallBanner") === "1") return;

  if (e.webInstallBanner) {
    setTimeout(() => {
      if (sessionStorage.getItem("dismissedInstallBanner") !== "1" && loadSettings().installBannerEnabled !== false) {
        e.webInstallBanner.classList.remove("hidden");
      }
    }, 1800);
  }
}

fetchLatestGitHubReleaseMeta();
setTimeout(checkAndDisplayWebInstallBanner, 1000);

window.addEventListener("online", syncOfflineQueue);
// ==================== IN-APP UPDATE KHUSUS MOBILE ====================
let pendingMobileUpdateInfo = null;

window.onAppUpdateDetected = function(data) {
  if (!data) return;
  if (data.available) {
    pendingMobileUpdateInfo = data;
    // Beri indikator titik kuning halus pada ikon pengaturan tanpa mengganggu alur kasir
    if (e.settingsBtn) e.settingsBtn.classList.add("has-update");

    // Siapkan kotak verifikasi di dalam dialog pengaturan
    if (e.mobileUpdateVerifyBox) {
      if (e.mobileUpdateTargetTag) {
        e.mobileUpdateTargetTag.textContent = `Pembaruan Tersedia: ${data.tagName || data.versionName}`;
      }
      if (e.mobileUpdateSizeInfo) {
        const sizeKb = data.apkSize ? Math.round(data.apkSize / 1024) + " KB" : "~850 KB";
        e.mobileUpdateSizeInfo.textContent = `Ukuran APK: ${sizeKb}`;
      }
      if (e.mobileUpdateChangelog) {
        e.mobileUpdateChangelog.textContent = data.body || "Pembaruan versi terbaru dengan peningkatan stabilitas dan fitur.";
      }
      e.mobileUpdateVerifyBox.style.display = "block";
    }

    if (e.mobileUpdateHelpText) {
      e.mobileUpdateHelpText.textContent = `Versi baru (${data.tagName}) telah tersedia. Buka verifikasi untuk update.`;
      e.mobileUpdateHelpText.style.color = "var(--yellow)";
    }

    if (data.isManual) {
      toast("Versi baru aplikasi tersedia", "info");
    }
  } else if (data.isManual) {
    toast(`Aplikasi sudah versi terbaru (${data.currentVersion || "v1.2.0"})`, "info");
    if (e.mobileUpdateHelpText) {
      e.mobileUpdateHelpText.textContent = "Aplikasi Anda sudah menggunakan versi terbaru.";
      e.mobileUpdateHelpText.style.color = "var(--muted)";
    }
    if (e.mobileUpdateVerifyBox) {
      e.mobileUpdateVerifyBox.style.display = "none";
    }
    if (e.settingsBtn) {
      e.settingsBtn.classList.remove("has-update");
    }
  }
};

function semverIsNewer(latest, current) {
  try {
    const l = latest.replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
    const c = current.replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
    const len = Math.max(l.length, c.length);
    for (let i = 0; i < len; i++) {
      const lv = l[i] || 0;
      const cv = c[i] || 0;
      if (lv > cv) return true;
      if (lv < cv) return false;
    }
    return false;
  } catch (_) {
    return false;
  }
}

async function checkGitHubReleaseFallback() {
  if (e.checkMobileUpdateBtnText) e.checkMobileUpdateBtnText.textContent = "Memeriksa...";
  if (e.checkMobileUpdateBtn) e.checkMobileUpdateBtn.disabled = true;
  try {
    const res = await fetch("https://api.github.com/repos/Ramadani1t/QRISKas/releases/latest");
    if (res.ok) {
      const data = await res.json();
      const currentVer = (window.QriskasAndroid?.getAppVersionName ? window.QriskasAndroid.getAppVersionName() : "1.2.0").replace(/^v/, "");
      const latestVer = (data.tag_name || "").replace(/^v/, "");
      let apkUrl = "";
      let apkSize = 0;
      if (Array.isArray(data.assets)) {
        const apkAsset = data.assets.find(a => (a.name || "").endsWith(".apk"));
        if (apkAsset) {
          apkUrl = apkAsset.browser_download_url;
          apkSize = apkAsset.size;
        }
      }
      const isNewer = semverIsNewer(latestVer, currentVer);
      window.onAppUpdateDetected({
        available: isNewer,
        tagName: data.tag_name,
        versionName: latestVer,
        releaseName: data.name,
        apkUrl: apkUrl,
        htmlUrl: data.html_url || "https://github.com/Ramadani1t/QRISKas/releases/latest",
        apkSize: apkSize,
        body: data.body,
        isManual: true,
        currentVersion: currentVer
      });
    } else {
      toast("Gagal memeriksa pembaruan", "error");
    }
  } catch (_) {
    toast("Gagal terhubung ke server pembaruan", "error");
  } finally {
    if (e.checkMobileUpdateBtnText) e.checkMobileUpdateBtnText.textContent = "Periksa Pembaruan Versi";
    if (e.checkMobileUpdateBtn) e.checkMobileUpdateBtn.disabled = false;
  }
}

if (e.checkMobileUpdateBtn) {
  e.checkMobileUpdateBtn.addEventListener("click", () => {
    if (window.QriskasAndroid && typeof window.QriskasAndroid.checkAppUpdate === "function") {
      if (e.checkMobileUpdateBtnText) e.checkMobileUpdateBtnText.textContent = "Memeriksa...";
      e.checkMobileUpdateBtn.disabled = true;
      window.QriskasAndroid.checkAppUpdate();
      setTimeout(() => {
        if (e.checkMobileUpdateBtnText) e.checkMobileUpdateBtnText.textContent = "Periksa Pembaruan Versi";
        if (e.checkMobileUpdateBtn) e.checkMobileUpdateBtn.disabled = false;
      }, 2500);
    } else {
      checkGitHubReleaseFallback();
    }
  });
}

if (e.executeMobileUpdateBtn) {
  e.executeMobileUpdateBtn.addEventListener("click", () => {
    if (!pendingMobileUpdateInfo || !pendingMobileUpdateInfo.apkUrl) {
      toast("Link unduhan APK belum tersedia", "warning");
      return;
    }
    toast("Mengunduh file pembaruan APK", "loading");
    if (window.QriskasAndroid && typeof window.QriskasAndroid.downloadAndInstallUpdate === "function") {
      window.QriskasAndroid.downloadAndInstallUpdate(
        pendingMobileUpdateInfo.apkUrl,
        pendingMobileUpdateInfo.tagName || "v1.2.0"
      );
    } else if (window.QriskasAndroid && typeof window.QriskasAndroid.openExternalUrl === "function") {
      window.QriskasAndroid.openExternalUrl(pendingMobileUpdateInfo.apkUrl);
    } else {
      window.open(pendingMobileUpdateInfo.apkUrl, "_blank");
    }
  });
}

if (e.openMobileUpdateBtn) {
  e.openMobileUpdateBtn.addEventListener("click", () => {
    const apkUrl = pendingMobileUpdateInfo?.apkUrl || "";
    const htmlUrl = pendingMobileUpdateInfo?.htmlUrl || "https://github.com/Ramadani1t/QRISKas/releases/latest";
    const tagName = pendingMobileUpdateInfo?.tagName || "v1.4.2";

    if (window.QriskasAndroid && typeof window.QriskasAndroid.openUpdate === "function") {
      window.QriskasAndroid.openUpdate(apkUrl, htmlUrl, tagName);
    } else if (window.QriskasAndroid && typeof window.QriskasAndroid.openExternalUrl === "function") {
      window.QriskasAndroid.openExternalUrl(htmlUrl);
    } else {
      window.open(htmlUrl, "_blank");
    }
  });
}

if (e.dismissMobileUpdateBtn) {
  e.dismissMobileUpdateBtn.addEventListener("click", () => {
    if (e.mobileUpdateVerifyBox) e.mobileUpdateVerifyBox.style.display = "none";
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => console.log("SW error:", err));
  });
}

