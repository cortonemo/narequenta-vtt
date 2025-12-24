![Repository Header Image](header_image.jpeg)
# Nárëquenta — Tales of the Waning (Foundry VTT)

**Version: v0.9-BETA (Decay Mitigation and Tier I Stabilization)**
**Author:** Serelith Varn (cortonemo)
**License:** Nárëquenta Limited Open License (v0.1)
**Compatibility:** Foundry VTT v11+

-----

## 💡 Core Philosophy: Attrition is Meaning

Nárëquenta is a TTRPG about **Beautiful Erosion**. Heroes start at their peak and gradually fade as they act and spend their Essence. Progression is the **defining of character through loss**.

**Core Axiom (v0.9):** Power is a finite resource. The real threat is the **Extinction of Essence**. **Proficiency Compensates for Decline**, allowing maximum impact with minimal capacity.

## ⚙️ System Features

The Foundry VTT implementation automates the core math of Nárëquenta:

  * **Essence Management:** Tracks **E_max** (Permanent Potential) and **E_cur** (Daily Energy).
  * **Automated Waning Roll:** The "Trigger Waning Phase" button handles the complex logic of **Focus (2d6)** vs **Universal (1d6)** decay, including the **Tier I Guarantee** logic.
  * **Interactive Damage Calculator:** Built directly into the Character and NPC sheets to handle the **Additive Damage Formula** and **Tier Advantage Multipliers**.
  * **Localization:** Fully localized in English and Portuguese.

## 🧮 Math Reference (v0.9)

  * **Damage Formula:**
    $$\mathbf{D_{Final}} = \max \left( 0, (A_{FP} - \bar{M}_{Defense} + D_{Margin} + R_{prof}) \right) \times M_{DTA} \text{}$$

  * **Tier Sync:** * **E_max Floor:** 50%
    * **Tier I Guarantee:** First focus roll guarantees a drop to 90%.

-----

### 📦 Installation

1. Open Foundry VTT.
2. Go to **Game Systems** -> **Install System**.
3. Paste the Manifest URL: 
   `https://github.com/cortonemo/narequenta-vtt/releases/latest/download/system.json`
4. Click **Install**.

-----

### 📜 License & Authorship

**© 2025 Serelith Varn**
This project is released under the **Nárëquenta Limited Open License (v0.1)**.
You are free to play, stream, and create fan content for this system—provided you give proper credit and do not use it commercially.

This software is based on the **Simple Worldbuilding System** by Atropos, used under the MIT License.

📜 [Read the full license →](LICENSE.md)