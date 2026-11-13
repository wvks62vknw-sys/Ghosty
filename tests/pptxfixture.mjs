// A .pptx written by hand, NOT by the app's own writer (BRIEF-EDITOR-PRESENTATIONS): the shape of a file PowerPoint saves, made with this
// file's own little zip writer and its own XML, so the app's reader is tried on a file it did not make. Two slides:
//   1. a title and a subtitle (the title placeholders), a picture with its description, a video on a link, speaker notes ("Welcome everyone");
//   2. a title, two bullets (the second a link), a table of two rows, a chart part, an animation and a transition.
// What the reader should keep: both slides' words, the notes, the order, the table, the picture's presence, the layout; and say it could not keep
// a video on slide 1, a chart, animations and a wipe transition (one the editor has no word for) on slide 2.
import { Buffer } from 'node:buffer';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAkCAIAAAC2bqvFAAAAU0lEQVR4nO3PUQkAIBTAwBfHiEY0liH8OITBAtxm7fN1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1owWMXW6CotXLrFqsAAAAASUVORK5CYII=', 'base64');
const enc = new TextEncoder();
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(files) {
  const parts = [];
  const central = [];
  let off = 0;
  for (const [name, data0] of files) {
    const data = typeof data0 === 'string' ? enc.encode(data0) : data0;
    const nm = enc.encode(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8); lh.writeUInt32LE(crc(data), 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(crc(data), 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
    parts.push(lh, nm, data);
    central.push(ch, nm);
    off += 30 + nm.length + data.length;
  }
  const dir = Buffer.concat(central.map((c) => Buffer.from(c)));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts.map((p) => Buffer.from(p)), dir, end]));
}

const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const rels = (items) => `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target, ext]) => `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"${ext ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
const ph = (id, name, type, x, y, cx, cy, body) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph ${type}/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp>`;
const grp = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';

export function foreignPptx() {
  const slide1 = `${X}<p:sld ${NS}><p:cSld><p:spTree>${grp}
${ph(2, 'Title 1', 'type="ctrTitle"', 1524000, 1122363, 9144000, 2387600, '<a:p><a:r><a:rPr lang="en-US"/><a:t>Quarterly review</a:t></a:r></a:p>')}
${ph(3, 'Subtitle 2', 'type="subTitle" idx="1"', 1524000, 3602038, 9144000, 1655762, '<a:p><a:pPr marL="0" indent="0"><a:buNone/></a:pPr><a:r><a:rPr lang="en-US" b="1"/><a:t>Prepared by the team</a:t></a:r></a:p>')}
<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture 3" descr="A blue banner"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="838200" y="5300000"/><a:ext cx="2000000" cy="1125000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
<p:pic><p:nvPicPr><p:cNvPr id="5" name="Video 4"/><p:cNvPicPr/><p:nvPr><a:videoFile r:link="rId9"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="7000000" y="5300000"/><a:ext cx="2000000" cy="1125000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const slide2 = `${X}<p:sld ${NS}><p:cSld><p:spTree>${grp}
${ph(2, 'Title 1', 'type="title"', 838200, 365125, 10515600, 1325563, '<a:p><a:r><a:rPr lang="en-US"/><a:t>The numbers</a:t></a:r></a:p>')}
${ph(3, 'Content Placeholder 2', 'idx="1"', 838200, 1825625, 10515600, 1500000, '<a:p><a:r><a:rPr lang="en-US"/><a:t>First point</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US"><a:hlinkClick r:id="rId5"/></a:rPr><a:t>Second point, a link</a:t></a:r></a:p>')}
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Table 3"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="838200" y="3500000"/><a:ext cx="6096000" cy="800000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid><a:gridCol w="3048000"/><a:gridCol w="3048000"/></a:tblGrid>
<a:tr h="400000"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Region</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Sales</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr>
<a:tr h="400000"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>North</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>120</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc></a:tr>
</a:tbl></a:graphicData></a:graphic></p:graphicFrame>
<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="5" name="Chart 4"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="7200000" y="3500000"/><a:ext cx="4000000" cy="2500000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId6"/></a:graphicData></a:graphic></p:graphicFrame>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr><p:transition spd="med"><p:wipe dir="d"/></p:transition><p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"/></p:par></p:tnLst></p:timing></p:sld>`;
  const notes1 = `${X}<p:notes ${NS}><p:cSld><p:spTree>${grp}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Welcome everyone</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;
  const theme = `${X}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2><a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4><a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  const master = `${X}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${grp}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/><p:sldLayoutId id="2147483650" r:id="rId2"/></p:sldLayoutIdLst></p:sldMaster>`;
  const layout = (type, name) => `${X}<p:sldLayout ${NS} type="${type}" preserve="1"><p:cSld name="${name}"><p:spTree>${grp}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const presentation = `${X}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  return zip([
    ['[Content_Types].xml', `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>`],
    ['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])],
    ['ppt/presentation.xml', presentation],
    ['ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'slide', 'slides/slide1.xml'], ['rId3', 'slide', 'slides/slide2.xml'], ['rId4', 'theme', 'theme/theme1.xml']])],
    ['ppt/slideMasters/slideMaster1.xml', master],
    ['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'slideLayout', '../slideLayouts/slideLayout2.xml'], ['rId3', 'theme', '../theme/theme1.xml']])],
    ['ppt/slideLayouts/slideLayout1.xml', layout('title', 'Title Slide')],
    ['ppt/slideLayouts/slideLayout2.xml', layout('obj', 'Title and Content')],
    ['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
    ['ppt/slideLayouts/_rels/slideLayout2.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])],
    ['ppt/theme/theme1.xml', theme],
    ['ppt/slides/slide1.xml', slide1],
    ['ppt/slides/_rels/slide1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'image', '../media/image1.png'], ['rId3', 'notesSlide', '../notesSlides/notesSlide1.xml'], ['rId9', 'video', 'https://example.com/clip.mp4', true]])],
    ['ppt/slides/slide2.xml', slide2],
    ['ppt/slides/_rels/slide2.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout2.xml'], ['rId5', 'hyperlink', 'https://example.com/more', true], ['rId6', 'chart', '../charts/chart1.xml']])],
    ['ppt/notesSlides/notesSlide1.xml', notes1],
    ['ppt/media/image1.png', new Uint8Array(PNG)],
    ['docProps/core.xml', `${X}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Quarterly review deck</dc:title></cp:coreProperties>`],
  ]);
}
