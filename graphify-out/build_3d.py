"""Build graph_3d.html with embedded data and 3d-force-graph viewer.

Enriches each node and link with extra metadata so the viewer can render
visually meaningful structure:

  * community_size — used to scale community colors
  * is_hub — top 1% by degree, rendered larger and with halo
  * cross_community — links that bridge two communities (rendered in white,
    higher opacity); intra-community links get the source community's color
  * weight — link rendering width; god-node-incident links get more weight
"""
import json, re
from pathlib import Path
from collections import Counter
from networkx.readwrite import json_graph

data = json.loads(Path('graphify-out/graph.json').read_text(encoding='utf-8'))
G = json_graph.node_link_graph(data, edges='links')

report = Path('graphify-out/GRAPH_REPORT.md').read_text(encoding='utf-8')
labels = {int(m.group(1)): m.group(2)
          for m in re.finditer(r'### Community (\d+) - "([^"]+)"', report)}

# Pre-pass: distribución de degree para detectar hubs (top 1%).
all_degrees = sorted((G.degree(n) for n in G.nodes()), reverse=True)
hub_threshold = all_degrees[max(1, len(all_degrees) // 100)] if all_degrees else 0

# Tamaño de cada comunidad para que el viewer pueda atenuar nodos sueltos.
community_sizes = Counter(int(d.get('community', 0)) for _, d in G.nodes(data=True))

nodes_payload = []
node_community = {}
for nid, ndata in G.nodes(data=True):
    cid = int(ndata.get('community', 0))
    deg = G.degree(nid)
    node_community[nid] = cid
    nodes_payload.append({
        'id': nid,
        'label': ndata.get('label', nid),
        'community': cid,
        'community_label': labels.get(cid, f'C{cid}'),
        'community_size': community_sizes.get(cid, 1),
        'source_file': ndata.get('source_file') or '',
        'file_type': ndata.get('file_type', ''),
        'degree': deg,
        'is_hub': deg >= hub_threshold and deg >= 30,
    })

links_payload = []
for u, v, edata in G.edges(data=True):
    cu = node_community.get(u, -1)
    cv = node_community.get(v, -2)
    deg_max = max(G.degree(u), G.degree(v))
    links_payload.append({
        'source': u,
        'target': v,
        'relation': edata.get('relation', ''),
        'confidence': edata.get('confidence', ''),
        # Si une dos comunidades distintas, marca cross_community: el viewer
        # los pinta blanco (visibilidad), los intra-community heredan color
        # de la comunidad source (efecto "racimos coloreados").
        'cross_community': cu != cv,
        'src_community': cu,
        # Peso visual: log-ish de degree del nodo más conectado en el par.
        # Hub-incident links se ven más gruesos => visualizan god nodes.
        'weight': max(1, min(int(deg_max ** 0.5), 8)),
    })

payload = {
    'nodes': nodes_payload,
    'links': links_payload,
    'meta': {
        'hub_threshold': hub_threshold,
        'communities': len(community_sizes),
    },
}
print(f'Payload: {len(nodes_payload)} nodes / {len(links_payload)} links')
print(f'  hubs (deg >= {hub_threshold}): {sum(1 for n in nodes_payload if n["is_hub"])}')
print(f'  cross-community links: {sum(1 for l in links_payload if l["cross_community"])}')

embedded_json = json.dumps(payload, ensure_ascii=False)

template = Path('graphify-out/graph_3d_template.html').read_text(encoding='utf-8')
html_final = template.replace('__GRAPH_DATA__', embedded_json)
out = Path('graphify-out/graph_3d.html')
out.write_text(html_final, encoding='utf-8')
print(f'graph_3d.html: {out.stat().st_size:,} bytes')
