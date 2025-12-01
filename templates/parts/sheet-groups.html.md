<ol class="groups-list">
    {{!-- Loop through attribute groups --}}
    {{#each groups as |group groupKey|}}
    <li class="group" data-group="{{groupKey}}">
        {{> "systems/narequenta/templates/parts/sheet-attributes.html" ... }}
    </li>
    {{/each}}
</ol>