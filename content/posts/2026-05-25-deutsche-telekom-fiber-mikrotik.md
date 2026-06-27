+++
title = "Deutsche Telekom Fiber with a MikroTik Router"
date = 2026-05-25
tags = ["networking", "tech"]
references = [
    "https://help.mikrotik.com/docs/spaces/ROS/pages/88014957/VLAN",
    "https://help.mikrotik.com/docs/spaces/ROS/pages/2031625/PPPoE",
    "https://help.mikrotik.com/docs/spaces/ROS/pages/3211299/NAT",
    "https://help.mikrotik.com/docs/spaces/ROS/pages/328078/Filter",
    "https://en.wikipedia.org/wiki/Point-to-Point_Protocol_over_Ethernet",
    "https://en.wikipedia.org/wiki/Broadband_remote_access_server",
    "https://en.wikipedia.org/wiki/IEEE_802.1Q",
    "https://telekomhilft.telekom.de/conversations/festnetz-internet/richtige-vlan-und-qos-werte-bei-der-telekom/668713c34ae73561da489b4e",
    "https://administrator.de/knowledge/einwahlparameter-verschiedener-deutscher-dsl-provider-mit-vlan-id-516717.html",
    "https://www.glasfaserforum.de/forum/thread/1860-%C3%BCbersicht-vlan-ids-und-einwahlkonfigurationen-verschiedener-anbieter/",
    "https://www.reddit.com/r/HomeNetworking/comments/uhylhc/eli5_why_some_isps_require_vlan_tagging/",
    "https://www.tingolin.eu/posts/telekom-fibre-own-router/",
    "https://gist.github.com/madduci/8b8637b922e433d617261373220be44c",
    "https://www.tp-link.com/de/support/faq/3659/",
    "https://telekomhilft.telekom.de/conversations/festnetz-internet/pppoe-einwahl-%C3%BCber-einen-router-herstellen/668606124ae73561da55c804",
    "https://www.dnetz.de/infothek/pfsense-pppoe-an-ftth-modem-glasfaseranschluss",
    "https://www.fs.com/blog/pon-network-management-an-indepth-guide-to-oam-ploam-and-omci-2951.html",
]
+++

I switched to Deutsche Telekom Glasfaser (FTTH) and wanted to keep my MikroTik
router. No FritzBox, no rented hardware, just my own box talking to the ONT.

It took a couple of hours to get it working, and the journey involved a fair
amount of trial and error. Here's what I tried, what failed, and what finally
worked.

## The setup

- **Router**: MikroTik hAP ac
- **ONT**: Deutsche Telekom Modem 2 fiber box, ethernet out

```
┌─────────┐         ┌─────┐          ┌──────────┐
│  Fiber  │──fiber──│ ONT │──eth────▶│ MikroTik │
└─────────┘         └─────┘          │  ether1  │
                                     └──────────┘
```

## What I tried (and failed)

### Attempt 0: swap the modem

My old setup was straightforward: a DSL modem on ether1 (the WAN port), with the
MikroTik running a DHCP client to get an IP from it.

I unplugged the DSL modem, plugged in the fiber ONT on the same port, and kept
the same config. Nothing happened. DHCP stayed searching.

### Attempt 1: DHCP on bare ether1

Same idea, but with a fresh DHCP client on the WAN port.

```
/ip dhcp-client add interface=ether1 add-default-route=yes use-peer-dns=yes
```

DHCP stayed in "searching" forever. A packet capture showed the discovery going
out, but no reply ever came back.

### Attempt 2: DHCP on VLAN 7

After some digging, I found that Telekom uses VLAN 7 for internet traffic. This
isn't documented on Telekom's official setup page; the only sources are
community forum posts, third-party guides, and ISP parameter lists floating
around German networking forums.

I tagged the port and tried again:

```
/interface vlan add interface=ether1 name=vlan7 vlan-id=7
/ip dhcp-client add interface=vlan7 add-default-route=yes use-peer-dns=yes
```

Same result. No reply.

### Attempt 3: static IP through the ONT

The ONT has a management interface at `192.168.100.1`. Setting a static IP in
that subnet worked for reaching the ONT itself:

```
/ip address add address=192.168.100.2/24 interface=ether1
/ping 192.168.100.1  # works
/ping 8.8.8.8        # nothing
```

The ONT was reachable, but the internet was not. It simply wasn't forwarding
traffic.

### Attempt 4: proving it's not the router

Telekom support wasn't particularly helpful. They said they "don't support exotic
routers" and asked whether my router "supports WAN." No technical details, no
real troubleshooting.

So I decided to prove it myself. I plugged a laptop directly into the ONT and
ran the same tests:

```
sudo ip addr add 192.168.100.2/24 dev eno1
sudo ip route add default via 192.168.100.1
ping 192.168.100.1  # works
ping 8.8.8.8        # nothing
```

Same behavior, no router involved. The ONT itself wasn't passing traffic to the
internet.

## What worked: PPPoE on VLAN 7

Finally, after more searching and getting some help from colleagues, I tried
PPPoE on VLAN 7:

```
/interface vlan add interface=ether1 name=vlan7 vlan-id=7
/interface pppoe-client add interface=vlan7 name=pppoe-telekom user=test password=test disabled=no
```

It connected. A public IP was assigned and I had internet.

Interestingly, the PPPoE credentials didn't even matter: `user=test
password=test` was enough. The ONT handles authentication via PLOAM (the
fiber-level protocol), so Telekom doesn't actually check PPPoE credentials on
this line type. PPPoE is just the mechanism for IP assignment.

## Full working config

### Internet (PPPoE on VLAN 7)

```
/interface vlan add interface=ether1 name=vlan7 vlan-id=7
/interface pppoe-client add interface=vlan7 name=pppoe-telekom user=test password=test disabled=no
/ip firewall nat add chain=srcnat out-interface=pppoe-telekom action=masquerade
```

### ONT web UI access from LAN

The ONT has a management page at `192.168.100.1`. To reach it from LAN devices,
the router needs an IP in the same subnet.

```
/ip address add address=192.168.100.2/24 interface=ether1
```

This works because ether1 carries two types of traffic side by side:

- **Untagged**: `192.168.100.x` for ONT management
- **VLAN 7 tagged**: PPPoE tunnel for internet

Since `ether1` is in MikroTik's WAN interface list, the default masquerade rule
handles NAT for LAN → ONT traffic. No extra rules are needed.

## Why VLAN 7 and PPPoE

Telekom uses VLAN tags to separate services on the same physical wire. VLAN 7 is
for internet traffic. Untagged frames get ignored, which is why bare DHCP didn't
work.

PPPoE (Point-to-Point Protocol over Ethernet) wraps the traffic in a
point-to-point tunnel. Telekom's server (BRAS/BNG) assigns a public IP through
this tunnel.
