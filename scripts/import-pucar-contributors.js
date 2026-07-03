#!/usr/bin/env node
/*
  One-off import of the contributors listed on https://pucar.org/about
  (scraped 2026-07-03). Writes content/contributors/<slug>.json for each.
  Safe to re-run: overwrites the files it owns, never touches other slugs.

  Line format below: Name ~ Organisation/affiliation ~ linkedin-slug ~ framer image file
*/
const fs = require("fs");
const path = require("path");

const IMG = "https://framerusercontent.com/images/";
const DATA = `
Ajay Nandalika~Lawyer~ajayjn~rreoTuUqX4h7eUG66XHGvWERqs.webp
Tahera Bharmal~eGovernments Foundation~taherabharmal~pv7GwRSpyQDzDQmwYojyK7xNaCQ.jpg
Rangin Tripathy~NLU Orissa~rangin-pallav-tripathy-841492137~a7MjNfgseYMUHfuJH42mayIAXqY.jpeg
Susan Thomas~XKDR~susan-thomas-417869~MF4gpz8BUmhCXGdBf0sd6zLmds.jpg
Manish Srivastava~eGovernments Foundation~manishsv~tTywC9sILiiPNplIleUAH1l9a38.jpeg
Supriya Sankaran~Agami~supriya-sankaran-b9b89917~sGKfoGNlFaW4PghSOJD9gE4VLg.jpg
Jeevika Shiv~UN Women~jeevikashiv~wTJsbV4MsWWGG6QIJejN6miYfhM.jpeg
Ashok Pal Singh~Ex-Bureaucrat~ashok-pal-singh-91297b13~laopdNn74aONalF7cbgxkWymqBQ.webp
Abhimanyu Timbadia~Samagra~abhimanyu-timbadia-83a1761b4~RPSk3p4AiSQ7vbJvfqkoSOiTfM.jpg
Anshumanth Rao~eGovernments Foundation~tn-anshumanth-rao~ZqzGnoqtB24Bwt9Q57bl5loN5Vg.png
Abhishek Rao~Samagra~abhishek-rao-479047159~yJdgsttXRPd6uT0ry0NklRl0vY.jpg
Keerthana Medarametla~Agami~keerthana-medarametla-8497b725~wzbJHT9mwN648u7z6w6BFzTXoc.jpg
Nikhil Nadigar~Samagra~nikhil-nadiger~8ZPHcH4I2F7vc6jdHU0GpDoWBrs.jpg
Akshay Rongta~Ooloi Labs~akshay-roongta-scale~pLeJeY2DYxkakplNrWF6a1plwEU.webp
Aishwariya Dixit~Deloitte~aishwarya-dixit-592198191~hwNy8qFmC5kKe69zInUJD7fp3t4.webp
Aditi Phadnis~Samagra~aditi-phadnis93~e2dt3Nhqvh3d5ayPQGYXi5iKJGw.jpg
Atul Gupta~Agami~atul-gupta-588a8812~c1WdVkrsY044aS47gv84aZCtbS0.jpg
Bharath Chugh~Former Judge, Delhi Judicial Service~bharat-chugh-07b15ba~dEN0lmDFFq1KBgiqOCgZkFI8BdA.webp
Bhargavi Zaveri-Shah~XKDR~bhargavi-zaveri-shah-92a46461~RS4hjDmE2Cn4ZokIsuCbEJPzPds.jpg
Chittu Nagarajan~CREK ODR~chittu-nagarajan-54668b~3tbZ5dfKvHnUbMqsckQDtwR4w4.webp
Deepika Kinhal~CORD~deepika-kinhal-8717a0b~rscuKzkgY4nuqdQpfCikY4kIkzQ.jpg
Deeshita Soin~Samagra~deeshita-soin-a4b8a91a5~yJ1m38KBzVvXgtS7dg5Oe4kBwQ.jpg
Devaraj D~Samagra~d-devaraj-1a8295122~Rd84nU3cLvyVVQV2THbcdkKzcXM.jpg
Gaurav Goel~Samagra~gaurav-goel-samagra~sBsqnlh8gaO00KyAgJ1ZRTWLPI.jpg
Kailash Nadh~Zerodha~kailashnadh~uzb4oRJ7zrfae1676OU4mMfWIco.jpeg
Kanchan Gupta~CADRE~kanchangupta~2lxn2E85BuPdi7F6aH1R0WcY0w8.jpeg
Kesava Moorthy~ADResNow~kesava-moorthy-8042635~m88EPmTiQOqWLzDx48H7qYY7kMg.jpeg
Kunal Ahirwar~Sahamati~kunal-ahirwar-a3358612a~wKq5oeLeRojtpiHh5XHHF0K01iE.jpeg
Madhav Pudipeddi~JustAct~pudipeddi-madhav-95a50020~I3hMGbKR3nCoSonzQ17yExt6Jc.jpeg
Mehul Sehgal~Samagra~mehulsehgal~hkrdpafadls8yNHnTW2vn3RGBM.jpeg
Mohammed Anas~Samagra~mohammed-anas-ahmed-811587203~0fOaIdRN5yR4RRn7OODUr5PPwGQ.jpg
Mugdha Mohapatra~XKDR Forum~mugdha-mohapatra-5a066a176~nu0ABixuCyVyeJFIcqtnbfWQ2XI.jpg
Nandakumar CK~Senior Advocate, Karnataka High Court~nandakumar-c-k-0a0077a~y3Y22t9piUa5Akc2lImTvQtA.jpeg
Nitin Kashyap~Samagra~nitin-kashyap-7573181~YDIgP4daQBcTCTVK4qevOSBU.jpg
Pavithra Manivannan~XKDR Forum~pavithra-manivannan-43b286164~GXK07oRM6WSuAILR8ND742hJLYg.jpg
Piyush Tewari~Save Life Foundation~ptewari~i5FNop0YslSGEeMAmBvZiBSwMo.jpeg
Pramod Rao~Innovator~pramod-rao-lawyer~y0w4R5JP2dg9SDyLUra4TRsWXbs.jpeg
Pramod Varma~Technology Architect~pramodkvarma~zSYvdalAohh98HGo5B56F7oPcE.jpeg
Priya Watwani~iProbono~priya-watwani-bba870ba~1hQQSqVTAQLzoLMEQoBqM6b3uA.jpeg
Priyanka Yadav~Deloitte~priyanka-yadav-10b49a30~jV2UeNx8hFteZiqQA1ArybpOx0.jpeg
Rahul Kulkarni~Samagra~rahul10100~555aqYA3DcmBvZAXkaqD0FHwimo.jpg
Rahul Matthan~Lawyer, Trilegal~rahul-matthan-b095543~4IFfNNu6MbOLSN79m9Q1ahQUnw.jpeg
Rajeesh Menon~Beckn~rajeesh-menon-2b3a004~hvMtqAG2Pp7hpso5LhztVqPGaQ.jpeg
Rajendran Nair~Presolv360~rajendran-nair-karakulam-a172babb~FA9BsKnAaiNMzQVVEFj6y7DM.jpeg
Rajneesh Jaswal~CADRE~rajneeshjaswal~KYAWS0SufjLBlUaIo6xvzb5cgbA.jpeg
Ravi Prakash~Beckn~warpcoderavi~vZG3RHDFOShgfyzi5gwOWfmz4cY.jpeg
Sarfraz Alam~~sarfraz-alam-113575201~jR64EiJrsBq0UWV3oWT8KMuhiI.jpeg
Sarika Rastogi~Piramal Foundation, Genpact CSR~sarika-rastogi-62759829~A6sfbGTylqU67R9AAziag8yQx0.jpeg
Satyam Thareja~Advocate on record, Supreme Court of India~satyamthareja~GMm3FvjzaUg9izVGtCvpWe97Y.jpeg
Sayak Mukherjee~SAMA~sayak-mukherjee-60903017a~J6Qlc8qgQnQrWtM3JvSb9IfBk.jpeg
Shiv Kumar Sareen~IPPB~shiv-kumar-sareen-4294278b~hJPpjUO1VTe5T2MVVweAkrU7Jc.jpeg
Shraddha Paghdar~SAMA~shraddha-paghdar~PxvXGsFwUJaFXyitWlQmdfo92c.jpeg
Shreyashi Soni~Samagra~shreyashi-soni-2908~kXHkWgJSnaqVGtlZbVjaJuZZJw.jpg
Shweta Devgan~CORD~shweta-devgan-7a1360b~SCy9dJ8IpIWZdOGVqeKfjhCtvs.jpeg
Siddarth Raman~XKDR Forum~siddarthraman~HVrKibEkcmCW4heFF8aQzI6LK4.jpg
Sravani Kuncharam Reddy~Deloitte~kuncharam-sravani-reddy~lqw0NlIiavdAlx0DTIb2ZCLM.jpeg
Subbaiah K.G.~CADRE~subbaiah-k-g-897703a8~XKawW2fHgnC3CNnB5f7JSamaU.jpeg
Subhashini Srinivasan~eGovernments Foundation~srinivasansubha~5jipt9GJtFK6MpbiOeZSfEcn5o.png
Suresh Unnikrishnan~Samagra~sureshunnikrishnan~xR0fXY7GTX9NkBDJK2vKq1ZIE.jpg
Surya Prakash B.S.~Daksh~suryaprakashbs~PrwZenTOKIS08Xh2rfXNlKT6f2E.jpeg
Swathi Sukumar~Advocate, Delhi High Court~swathisukumar~gcIGDMgQuwn16dtLLsLIfSWapg.jpg
Tanmay Bhateja~Samagra~tanmay-bhateja~w8VBcf7s9fwGZAsbWCIUkiq1XGY.jpg
Trishal Kumar~Deloitte~trishal-kumar-a1a186231~L1Az5IVEjCHoQw3Pm2H7WenskA.jpeg
Unmesh Kulkarni~Oceanic Circles~kulkarniunmesh~zV4YN7KG0L7RheVTVbyb7BkpAM.jpeg
Vamsi Madhav~Sahamati~vamsi74~wlIoWktDYuaPVpoIyg3dXXR1zY.jpeg
Varun Basu~eGovernments Foundation~varunbasu~0asmqljwqIqKZQagnP9eUCMvoqo.jpeg
Vijaykarthick T~JustAct~vijaykarthick-t-4545391a~EjjU3Y1PXR0Zrsb2YAbGGBDNfsE.jpeg
Vikas Mahendra~CORD~vikas-mahendra-47349514~Qocr9D83nl5saz1b7H407jwBBYY.jpeg
Vinay Mahendra~CORD~vinay-mahendra-21536619~UfY8YJA5K3EYZtAMisGPTVWa5U4.jpeg
Yashna Jhamb~Ooloi Labs~yashnajhamb~LTb9KKRPqtfiGp7ZlX3OnAJdo.jpeg
Vishwam Jindal~Webnyay~vishwamjindal~D0qV0ZbQVGrNcCUPHunJPORnfg.jpeg
Ramu Kandimalla~Technical Project Manager~ramu-kandimalla-a7886b192~9HP8uH6m5zDX7ygVpqZ6UmAv2cU.jpeg
Manimaraan~Tech Lead~manimaaran-sooriamoorthy-365a54106~YvJB64pTaezfVAm47id1nCb01g.jpeg
Venkata Rajesh Cherukumalli~QA Team Lead~rajesh-cherukumalli-974a3946~kbFBfRW2W3nDAdRCArKUalveA.jpeg
Bhuvanyu Guru~L2 Engineer~bhuvanyu02~bqUKpBKwjhjHjyzNO9zhwyI8vmA.jpeg
Mohammad Sawad~L1 Engineer~muhammed-sawad-p-m-221a2a335~TBwZxc4EoHbfyMrRS993Cjzgr6E.jpeg
Susmitha Behara~Technical Project Manager~susmita-behera-a30901249~kAQU98Q8SL0qwm63Fu0GSz4Ok.jpeg
`.trim();

function slugify(name) {
  return name.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const outDir = path.join(__dirname, "..", "content", "contributors");
let n = 0;
DATA.split("\n").forEach(function (line) {
  const [name, org, li, img] = line.split("~");
  const slug = slugify(name);
  const json = {
    name: name,
    role: "",
    organisation: org || "",
    photo: img ? IMG + img : "",
    email: "",
    links: li ? [{ label: "LinkedIn", url: "https://www.linkedin.com/in/" + li + "/" }] : [],
    source: "pucar.org/about",
    published: true,
    body: ""
  };
  fs.writeFileSync(path.join(outDir, slug + ".json"), JSON.stringify(json, null, 2) + "\n");
  n++;
});
console.log("wrote " + n + " contributor files to content/contributors/");
