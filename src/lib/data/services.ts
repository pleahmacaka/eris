type Service = {
  name: string
  host: string
}

export const services: Service[] = [
  { name: "ArixLab Matrix", host: "matrix.arixlab.com" },
]

export const serviceUrl = (service: Service) => `https://${service.host}`
