export class EvolutionClient {
    private baseUrl: string
    private apiKey: string

    constructor() {
        const rawUrl = process.env.EVOLUTION_API_URL || ''
        this.baseUrl = rawUrl.replace(/\/manager\/?$/, '').replace(/\/$/, '')
        this.apiKey = process.env.EVOLUTION_API_KEY || ''
    }

    async sendText(instanceId: string, number: string, text: string) {
        if (!this.baseUrl || !this.apiKey) {
            console.warn('Evolution API credentials not set')
            return
        }

        const url = `${this.baseUrl}/message/sendText/${instanceId}`
        console.log(`Sending message to ${url} for ${number}`)

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.apiKey
                },
                body: JSON.stringify({
                    number: number,
                    text: text,
                    delay: 1000,
                    linkPreview: false
                })
            })

            if (!response.ok) {
                console.error('Failed to send WhatsApp message', await response.text())
            }
        } catch (error) {
            console.error('Error sending WhatsApp message', error)
        }
    }
}
