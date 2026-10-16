// Synthetic descriptor structure, not an MT760 protocol capture.
export const collections: HIDCollectionInfo[] = [{
  usagePage: 0xff01, usage: 0, type: 1, children: [{
    usagePage: 0xff00, usage: 14, type: 0, children: [],
    inputReports: [{reportId: 6, items: [{reportSize: 8, reportCount: 28, usages: [1]}]}],
    outputReports: [], featureReports: [],
  }],
  inputReports: [], outputReports: [{reportId: 6, items: [{reportSize: 1, reportCount: 9}]}],
  featureReports: [{reportId: 6, items: [{reportSize: 8, reportCount: 28}]}],
}];
