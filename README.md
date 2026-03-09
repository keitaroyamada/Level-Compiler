# Level-Compiler

<p>
  <img src=https://github.com/user-attachments/assets/b80709f2-e609-445f-a5c5-542b0d91c9ba width="500" >
  <img src="test_data/demo.gif" width="410" >
</p>

## 1. About
Level Compiler (LC) is an integrated stratigraphic management software capable of creating and managing correlation models of sedimentary sequences. The system enables the management of multiple sediment cores on a unified depth or age scale. It also incorporates a "divider" that reprojects actual stratigraphic samples onto modelled depths, facilitating precise correlation across different researchers.

## 2. Install
### 2.1. Recommended environments(Development environment)
- Windows11
- macOS (+Apple silicon)
  
### 2.2. Windows
1. Download installer (*.exe) from the right panel ["Releases"](https://github.com/keitaroyamada/Level-Compiler/releases).
2. Run downloaded exe file. If Windows displays a “Windows protected your PC” or “Unknown publisher” message, click More info and then Run anyway to proceed with installation.

### 2.3. Mac(Apple silicon)
1. Download installer (*.dmg) from the right panel ["Releases"](https://github.com/keitaroyamada/Level-Compiler/releases).
2. Run downloaded "*.dmg" file and install Level Compiler.

## 3. Usage
The detailed usage will be uploaded by this summer.  
- 0.0. About Level Compiler
- 0.1. How to calculate the composite depth from correlation model ['Calculation method'(English / 日本語)](https://youtu.be/R7mAjAakmxA?si=F2C8oq4pJY23nPgh) 
- 1.1. Load correlation and age models  ['Load models' (English / 日本語)](https://youtu.be/Ydsx8dgI5Ec)
- 1.2. Load section images ['Load section images' (English / 日本語)](https://youtu.be/wR7f6GwND_s)
- 1.3. Plot data -Plotter-
- 1.4. Batch depth conversion -Converter-
- 1.5. Calc sampling depth -Divider- ['Divider Usage (English / 日本語)'](https://youtu.be/WAslven5zdE)
- 2.1. Description on core image -Labeler-   ['Labeler Usage (English / 日本語)'](https://youtu.be/SkIqG0wph_U)
- 2.2. Make model from GUI  ['Make model by GUI (English / 日本語)'](https://youtu.be/iKafKTT8cCY)
- 2.3. Make model from spreadsheet  ['Make model by csv (English / 日本語)'](https://youtu.be/sbdBxqxL3Cc)
  
### 3.1 Loading a Model

Loading a model is very simple. A model can be loaded either by **dragging and dropping the file into the Level Compiler (LC) window** or by using **File → Load Model**.

LC supports the following **native LC model formats**:

* `*.lcmodel` (recommended)
* `*.csv` (LC model CSV)

The **`.lcmodel` format is strongly recommended**, because it preserves the internal structure of the model and records modifications consistently.

When using an **LC CSV model**, the **file name must follow the required LC naming convention**, for example:

[correlation]Test Model for LC(2026-03-09 )

where `[correlation]` indicates the **model type**, `Test Model for LC` is the **model name**, and `(2026-03-09 )` is the **version name**.

Both **`.lcmodel` and LC CSV models** can be loaded using **drag-and-drop** or **File → Load Model**.

LC can also import **Level Finder (LF) CSV models**, but **LF CSV files use a different format and are not treated as LC models**. Therefore:

* LF CSV files **must be loaded using File → Import**
* LF CSV files **cannot be loaded using drag-and-drop or Load Model**
* LF CSV files **do not use the LC file naming convention**

During import, the LF model is **converted into an LC-compatible model**.

### 3.2 Loading Images

Image files stored in a folder with the **same name as the project** can be loaded by **dragging and dropping them into the Level Compiler**, and they will be displayed on the corresponding sections.

Image file names must follow the required naming convention:

`hole name + "-" + section name`

For example:

`P-01.tif`  
`Q-311.jpg`

Compressed folders (`.zip`) can also be loaded. However, note that the images must be **extracted before use**, which may require **additional processing time and disk space**.



## 4. Build from code(optional)
  __This section is optional.__ If it is not necessary, please proceed to [the next section](#3-Install).
  
  This step explains how to build the application from the source code.

- Windows11 & Mac (+Apple silicon)    
1. Download and install Python3 from [official site](https://www.python.org/).
2. Download and install Node.js form [official site](https://nodejs.org/en/).
3. Download and this repository from right upper green "Code" > "Download Zip".
4. Unzip the downloaded Zip file.
5. Start terminanl and move to the unzipped directory using change directory command("cd") and list segments command("ls").
6. Run the following code into the terminal to Install requirement packages.
   ```
   npm install
   npm list
   ```
   
7. Run the following code into the terminal to build executable file.

   - Windows11
   ```
   npm run build:win
   ```
   - Mac (+Apple silicon)
   ```
   npm run build:mac
   ```

8. Signing to the application (more optional)
   - Install Command line developper tools.
   - Generate Certificate Signing Request(CSR) file from Keychain.
   - Enroll in the Apple Developer Program.
   - Generate the Developer ID Application certificate(*.cer) from ADP using CSR.
   - Download and install CER file.
   - Download　Apple PKI file.
   - Check “Trust" the certificate.
   - The app will be automatically signed during the build process.
   
9. Move to next section.

## 5. References
