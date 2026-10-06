!macro NSIS_HOOK_POSTINSTALL
  nsExec::Exec '"$INSTDIR\eris.exe" --default-app register'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    nsExec::Exec '"$INSTDIR\eris.exe" --default-app unregister'
    ${If} ${FileExists} "$PROGRAMFILES64\eris-win-key-hook\eris-win-key-hook.exe"
      ExecShellWait "runas" "$INSTDIR\eris.exe" "--remove-win-hook" SW_HIDE
    ${EndIf}
    DeleteRegKey HKCU "Software\Classes\eris-files"
  ${EndIf}
!macroend
