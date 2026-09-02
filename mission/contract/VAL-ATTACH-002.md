### VAL-ATTACH-002: The attached file reaches the document store intact

A file attached through the app is present in the SharePoint document library and its
contents are byte-identical to what was uploaded. The app records where it went, so the
file can be found again without searching.
Tool: a real upload against the target site, then a checksum of the stored file
Evidence: matching checksums of the source and stored file, and the recorded location
