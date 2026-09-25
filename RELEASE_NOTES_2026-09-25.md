Level Compiler [v1.6.1] Latest

macOS 11 (Big Sur) and earlier versions are not supported.
For the initial installation, please download the appropriate installer.

Windows: .exe file
Mac: .dmg file

## High Priority

- Fixed erosion event creation to use the ID of the marker actually added
- Fixed EFD-based plot recalculation to call the correct age conversion method
- Fixed age-to-EFD conversion to extrapolate beyond the age model using the nearest two valid age points
- Fixed CD/EFD conversion outside the model range to use valid marker pairs for extrapolation
- Fixed age-based plot recalculation to save the updated CD and EFD values
- Excluded age CSV rows without a defined depth from the age model
- Rejected invalid CD-to-EFD conversion results when loading or updating age models

## Medium Priority

- Updated Finder age values when an age model is loaded or changed
- Generated age-scale core images for previously loaded image sources when an age model is selected
- Closed the previous model-loading progress window before starting image conversion progress
- Removed unused age conversion IPC handlers and preload APIs
