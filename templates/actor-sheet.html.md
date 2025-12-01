<form class="{{cssClass}} {{actor.type}}" autocomplete="off">

    {{!-- ================================================================= --}}
    {{!-- SHEET HEADER                                                      --}}
    {{!-- Contains: Profile Img, Name, Resource Bars, Rest Buttons          --}}
    {{!-- ================================================================= --}}
    <header class="sheet-header">
        <div class="header-fields">
            </div>
    </header>

    {{!-- ================================================================= --}}
    {{!-- NAVIGATION TABS                                                   --}}
    {{!-- Tabs: Essences, Abilities (Items), Biography                      --}}
    {{!-- ================================================================= --}}
    <nav class="sheet-tabs tabs" data-group="primary">
        </nav>

    <section class="sheet-body">

        {{!-- ================================================================= --}}
        {{!-- TAB 1: ESSENCES & COMBAT CALCULATOR                               --}}
        {{!-- ================================================================= --}}
        <div class="tab essences" data-group="primary" data-tab="essences">
            
            {{!-- A. Essence Grid (Vitalis, Motus, etc.) --}}
            <div class="essence-grid-container">
                </div>

            {{!-- B. Combat Calculator Panel --}}
            <div class="essence-grid-container" style="...">
                
                {{!-- 1. Calculator Header --}}
                <div style="...">
                    </div>

                {{!-- 2. Input Grid (Dice Rollers) --}}
                <div style="...">
                    </div>

                {{!-- 3. Action Bar --}}
                <div style="...">
                    </div>

                {{!-- 4. Output / Execution Area --}}
                </div>

            {{!-- C. Waning Phase (PC Only) --}}
            {{!-- D. Legacy Attributes (if any) --}}
            </div>

        {{!-- ================================================================= --}}
        {{!-- TAB 2: ITEMS (INVENTORY)                                          --}}
        {{!-- ================================================================= --}}
        <div class="tab items" data-group="primary" data-tab="items">
            <ol class="items-list">
                </ol>
        </div>

        {{!-- ================================================================= --}}
        {{!-- TAB 3: BIOGRAPHY                                                  --}}
        {{!-- ================================================================= --}}
        <div class="tab biography" data-group="primary" data-tab="biography">
            </div>

    </section>
</form>