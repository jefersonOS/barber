export class EvolutionClient {
    private baseUrl: string
    private apiKey: string

    constructor() {
        this.baseUrl = process.env.EVOLUTION_API_URL || ''
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
                    options: {
                        delay: 1000,
                        presence: "composing",
                        linkPreview: false
                    },
                    textMessage: {
                        text: text
                    }
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
