Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "LogicLib.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef DIST
  !define DIST "dist"
!endif
!ifndef OUTFILE
  !define OUTFILE "Eris_${VERSION}_x64-installer.exe"
!endif

Name "Eris ${VERSION}"
OutFile "${OUTFILE}"
BrandingText "Eris ${VERSION}"

!define MUI_ICON "..\apps\desktop\src-tauri\icons\icon.ico"
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_SMALLDESC

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Korean"
!insertmacro MUI_LANGUAGE "English"

LangString ErisDesc ${LANG_KOREAN} "독, 런처, 패널"
LangString ErisDesc ${LANG_ENGLISH} "Dock, launcher and panel"
LangString FilesDesc ${LANG_KOREAN} "파일 탐색기"
LangString FilesDesc ${LANG_ENGLISH} "File explorer"
LangString TerminalDesc ${LANG_KOREAN} "터미널"
LangString TerminalDesc ${LANG_ENGLISH} "Terminal"
LangString Failed ${LANG_KOREAN} "설치 실패"
LangString Failed ${LANG_ENGLISH} "Installation failed"

!macro RunSetup FILE
  SetOutPath "$PLUGINSDIR"
  File "${DIST}\${FILE}"
  ExecWait '"$PLUGINSDIR\${FILE}" /S' $0

  ${If} $0 != 0
    DetailPrint "$(Failed): ${FILE} ($0)"
    SetErrorLevel $0
  ${EndIf}
!macroend

Section "Eris" SecEris
  !insertmacro RunSetup "eris_${VERSION}_x64-setup.exe"
SectionEnd

Section "Eris Files" SecFiles
  !insertmacro RunSetup "Eris.Files_${VERSION}_x64-setup.exe"
SectionEnd

Section "Eris Terminal" SecTerminal
  !insertmacro RunSetup "Eris.Terminal_${VERSION}_x64-setup.exe"
SectionEnd

Function .onInit
  InitPluginsDir
FunctionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecEris} $(ErisDesc)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecFiles} $(FilesDesc)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecTerminal} $(TerminalDesc)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
