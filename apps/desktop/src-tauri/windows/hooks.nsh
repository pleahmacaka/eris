!macro NSIS_HOOK_POSTINSTALL
  nsExec::Exec '"$INSTDIR\eris.exe" --default-app register'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    nsExec::Exec '"$INSTDIR\eris.exe" --default-app unregister'
    DeleteRegKey HKCU "Software\Classes\eris-files"
  ${EndIf}
!macroend
