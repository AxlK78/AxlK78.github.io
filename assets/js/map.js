// Lab map: draws the nodes into the SVG and fills the side panel.
// One data source for the SVG, the mobile list and the panel.
(function () {
  "use strict";

  var C = { homelab: "cases/homelab.html", honeypot: "cases/honeypot.html", miner: "cases/container-miner.html", reverse: "cases/reverse-cfg.html", gns3: "cases/network-gns3.html" };

  var NODES = [
    { id: "internet", x: 260, y: 14, w: 200, h: 64, live: true,
      k: "OUTSIDE", t: "Internet", s: "where the honeypot lived",
      net: "public · any",
      p: "Before the home lab, I put a honeypot straight on the internet to see what actually arrives. It was scanned within minutes and never stopped.",
      links: [["70 hours on the open internet", "CF-02", C.honeypot]] },

    { id: "wan", x: 260, y: 112, w: 200, h: 50, live: true,
      k: "vmbr0 · WAN", t: "Home network", s: "DHCP from the ISP box",
      net: "vmbr0 → nic0 · DHCP",
      p: "The only bridge with a physical port. The firewall sits behind the ISP box (double NAT), so “block private networks” is off on the WAN and stateful filtering does the work.",
      links: [["Home lab, WAN settings", "CF-01", C.homelab + "#wizard"]] },

    { id: "fw", x: 240, y: 214, w: 240, h: 64, live: true,
      k: "VM 100 · OPNsense 26.7", t: "fw01.lab.internal", s: "routes and filters every zone",
      net: "6 vNICs · VirtIO · 2 vCPU · 2 GB",
      p: "Every zone below can only reach another zone, or the internet, through this VM. Interfaces were mapped by MAC address, and the admin UI only listens on the SIEM side.",
      links: [["A segmented home lab on one workstation", "CF-01", C.homelab]] },

    { id: "siem", x: 0, y: 384, w: 136, h: 80, live: true,
      k: "LAN · vmbr4", t: "SIEM", s: "10.10.10.0/24",
      net: "10.10.10.0/24 · gateway .1",
      p: "The trusted zone, so it also holds the firewall's admin interface, reached through an SSH tunnel. Wazuh goes here next. My Elastic/Kibana experience comes from the honeypot.",
      links: [["Home lab, access via SSH tunnel", "CF-01", C.homelab + "#access"], ["Reading 162,823 events in Kibana", "CF-02", C.honeypot]],
      planned: "Wazuh all-in-one, 6–8 GB" },

    { id: "attack", x: 146, y: 384, w: 136, h: 80, live: false,
      k: "OPT3 · vmbr3", t: "Attack", s: "10.10.20.0/24",
      net: "10.10.20.0/24 · planned",
      p: "Kali lives here. Allowed towards the targets and the AD zones, never towards the SIEM or my home network.",
      links: [["Home lab, zone plan", "CF-01", C.homelab + "#zones"]],
      planned: "Kali Linux, 4 GB" },

    { id: "dmz", x: 292, y: 384, w: 136, h: 80, live: false,
      k: "OPT4 · vmbr5", t: "DMZ", s: "10.10.30.0/24",
      net: "10.10.30.0/24 · planned",
      p: "Deliberately vulnerable web apps in Docker. Kept far from the domain controller so a popped web app is not a path to the domain. No internet access by default.",
      links: [["What a container can hide", "CF-03", C.miner], ["Home lab, zone plan", "CF-01", C.homelab + "#zones"]],
      planned: "Debian + Docker: DVWA, bWAPP, Juice Shop" },

    { id: "services", x: 438, y: 384, w: 136, h: 80, live: false,
      k: "OPT1 · vmbr1", t: "Services", s: "10.10.40.0/24",
      net: "10.10.40.0/24 · planned",
      p: "The domain controller, separated from the workstations like in a real company. Client-to-DC traffic (Kerberos, LDAP, SMB) has to cross the firewall, so it can be filtered and logged.",
      links: [["DC promotion rehearsal (logbook)", "AD", "#log"], ["Home lab, why split servers and clients", "CF-01", C.homelab + "#zones"]],
      planned: "Windows Server 2022, AD DS + DNS" },

    { id: "clients", x: 584, y: 384, w: 136, h: 80, live: false,
      k: "OPT2 · vmbr2", t: "AD clients", s: "10.10.50.0/24",
      net: "10.10.50.0/24 · planned",
      p: "Domain-joined Windows workstations with Sysmon and a Wazuh agent: the machines an attacker lands on first.",
      links: [["Home lab, zone plan", "CF-01", C.homelab + "#zones"]],
      planned: "Windows 10/11 Enterprise, Sysmon" },

    { id: "rev", x: 14, y: 530, w: 236, h: 54, live: true, bench: true,
      k: "BENCH", t: "Reverse engineering", s: "Ghidra · objdump · 3 ISAs",
      net: "offline · static analysis only",
      p: "Static analysis never touches the lab network: the WannaCry sample was analysed in an isolated REMnux VM and never executed.",
      links: [["Where Ghidra loses the thread", "CF-04", C.reverse], ["The WannaCry dropper", "CF-02", C.honeypot + "#reverse"]] },

    { id: "gns3", x: 264, y: 530, w: 236, h: 54, live: true, bench: true,
      k: "BENCH", t: "Network simulation", s: "GNS3 · iptables",
      net: "simulated · 6 routers, 6 hosts",
      p: "Where I learned routing and NAT before doing it on real hardware: two companies, two ISPs and a backbone.",
      links: [["Two companies, two ISPs, one backbone", "CF-05", C.gns3]] }
  ];

  var SVGNS = "http://www.w3.org/2000/svg";
  var group = document.getElementById("nodes");
  var panel = document.getElementById("panel");
  var canvas = document.querySelector(".map-canvas");
  if (!group || !panel) return;

  function el(name, attrs, text) {
    var e = document.createElementNS(SVGNS, name);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (text) e.textContent = text;
    return e;
  }

  // SVG nodes
  NODES.forEach(function (n) {
    var g = el("g", { "class": "node" + (n.live ? "" : " planned"), "data-id": n.id, tabindex: "0", role: "button", "aria-pressed": "false", "aria-label": n.t + ", " + n.k });
    g.appendChild(el("rect", { x: n.x + .75, y: n.y + .75, width: n.w - 1.5, height: n.h - 1.5, rx: 10 }));
    g.appendChild(el("rect", { "class": "tick", x: n.x + n.w - 14, y: n.y + 6, width: 8, height: 8, rx: 4 }));
    var tall = n.h >= 64;
    g.appendChild(el("text", { "class": "k", x: n.x + 12, y: n.y + 18 }, n.k));
    g.appendChild(el("text", { "class": "t", x: n.x + 12, y: n.y + (tall ? 38 : 36) }, n.t));
    if (tall) g.appendChild(el("text", { "class": "s", x: n.x + 12, y: n.y + n.h - 10 }, n.s));
    group.appendChild(g);
  });

  // Mobile list (shown instead of the SVG on narrow screens)
  var list = document.createElement("div");
  list.className = "map-list";
  NODES.forEach(function (n) {
    var b = document.createElement("button");
    b.type = "button";
    b.dataset.id = n.id;
    b.className = n.live ? "" : "planned";
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = "<span>" + n.k + "</span><b>" + n.t + "</b>";
    list.appendChild(b);
  });
  canvas.appendChild(list);

  function show(id) {
    var n = NODES.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    document.querySelectorAll("[data-id]").forEach(function (e) {
      e.setAttribute("aria-pressed", e.getAttribute("data-id") === id ? "true" : "false");
    });
    var html = '<span class="k">' + n.k + "</span><h3>" + n.t + '</h3><span class="net">' + n.net + "</span><p>" + n.p + "</p>";
    if (n.planned) html += '<span class="planned-note">Next: ' + n.planned + "</span>";
    html += "<ul>" + n.links.map(function (l) { return '<li><a href="' + l[2] + '">' + l[0] + "<span>" + l[1] + " →</span></a></li>"; }).join("") + "</ul>";
    panel.innerHTML = html;
  }

  function onPick(e) {
    var t = e.target.closest("[data-id]");
    if (t) show(t.getAttribute("data-id"));
  }
  group.addEventListener("click", onPick);
  list.addEventListener("click", onPick);
  group.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(e); }
  });

  show("fw");
})();
