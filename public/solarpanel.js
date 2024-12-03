document.addEventListener('DOMContentLoaded', () => {
    const addSolarPanelForm = document.getElementById('addSolarPanelForm');
    const solarPanelsTableBody = document.getElementById('solarPanelsTableBody');

    async function fetchSolarPanels() {
        try {
            const response = await fetch('/api/solar-panels');
            const panels = await response.json();
            renderSolarPanels(panels);
        } catch (error) {
            console.error('Erro ao carregar painéis solares:', error);
        }
    }

    function renderSolarPanels(panels) {
        solarPanelsTableBody.innerHTML = '';
        panels.forEach(panel => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${panel.panel_name}</td>
                <td>${panel.capacity_watts}</td>
                <td>${panel.installation_date}</td>
                <td>
                    <button class="btn btn-danger" onclick="removeSolarPanel(${panel.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            solarPanelsTableBody.appendChild(row);
        });
    }

    addSolarPanelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('solarPanelName').value;
        const capacity = parseInt(document.getElementById('solarPanelCapacity').value);
        const installationDate = document.getElementById('installationDate').value;
        const location = document.getElementById('solarPanelLocation').value;

        try {
            const response = await fetch('/api/solar-panels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ panel_name: name, capacity_watts: capacity, installation_date: installationDate, location })
            });

            if (!response.ok) {
                throw new Error('Erro ao adicionar painel solar');
            }

            await fetchSolarPanels(); // Atualiza a lista de painéis solares
            addSolarPanelForm.reset(); // Limpa o formulário
            const modal = bootstrap.Modal.getInstance(document.getElementById('addSolarPanelModal'));
            modal.hide(); // Fecha o modal
        } catch (error) {
            console.error('Erro ao adicionar painel solar:', error);
        }
    });

    window.removeSolarPanel = async (id) => {
        if (confirm('Você tem certeza que deseja remover este painel solar?')) {
            try {
                await fetch(`/api/solar-panels/${id}`, { method: 'DELETE' });
                await fetchSolarPanels(); // Atualiza a lista de painéis solares
            } catch (error) {
                console.error('Erro ao remover painel solar:', error);
            }
        }
    };

    fetchSolarPanels(); // Carrega os painéis solares ao iniciar
});

async function fetchAlerts() {
    try {
        const response = await fetch('/api/alerts');
        const alerts = await response.json();
        renderAlerts(alerts);
    } catch (error) {
        console.error('Erro ao carregar alertas:', error);
    }
}

function renderAlerts(alerts) {
    const alertsTableBody = document.getElementById('alertsTableBody');
    alertsTableBody.innerHTML = '';
    alerts.forEach(alert => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${alert.device_name}</td>
            <td>${alert.consumption}</td>
            <td>${new Date(alert.created_at).toLocaleString()}</td>
        `;
        alertsTableBody.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', fetchAlerts); // Carrega os alertas ao iniciar