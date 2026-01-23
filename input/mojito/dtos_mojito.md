# Mojito DTOs y enums (referencia)

## Modelos BD

### Ticket
```
namespace Mojito.Support.Model.BD
{
    public class Ticket
    {
        public int Id { get; set; }
        public string? Subject { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public string? SubCategory { get; set; }
        public int CompanyId { get; set; }
        public string? Status { get; set; }
        public DateTime CreatedOn { get; set; }
        public string? CreatedBy { get; set; }
        public DateTime ModifiedOn { get; set; }
        public string? ModifiedBy { get; set; }
        public bool IsReaded { get; set; } = true;
        public bool IsReadedAdmin { get; set; } = true;
        public IEnumerable<TicketUser> Users { get; set; }
        public IEnumerable<TicketMessage> Messages { get; set; }
    }
}
```

### TicketMessage
```
namespace Mojito.Support.Model.BD
{
    public class TicketMessage
    {
        public int Id { get; set; }
        public string Type { get; set; }
        public string Message { get; set; }
        public int TicketId { get; set; }
        public Ticket Ticket { get; set; }
        public DateTime CreatedOn { get; set; }
        public required string CreatedBy { get; set; }
        public DateTime ModifiedOn { get; set; }
        public required string ModifiedBy { get; set; }
 
        public List<TicketMessageAttachment> Attachments { get; set; }
    }
}
```

### TicketMessageAttachment
```
namespace Mojito.Support.Model.BD
{
    public class TicketMessageAttachment
    {
        public int Id { get; set; }
        public string URI { get; set; }
        public int TicketMessageId { get; set; }
        public TicketMessage TicketMessage { get; set; }
    }
}
```

### TicketUser
```
namespace Mojito.Support.Model.BD
{
    public class TicketUser
    {
        public int ID { get; set; }
        public required string User { get; set; }
        public int TicketID { get; set; }
        public Ticket Ticket { get; set; }
        public required DateTime CreatedOn { get; set; }
        public required string CreatedBy { get; set; }
        public required DateTime ModifiedOn { get; set; }
        public required string ModifiedBy { get; set; }
    }
}
```

## DTOs Help

### TicketDto
```
namespace Mojito.Support.Model.Dtos.Help
{
    public class TicketDto
    {
        public int? Id { get; set; }
        public DateTime? CreatedOn { get; set; }
        public string? Category { get; set; }
        public string? Subcategory { get; set; }
        public string? Subject { get; set; }
        public string? Description { get; set; }
        public List<string>? Attachments { get; set; }
        public string? User { get; set; }
        public string? Company { get; set; }
        public DateTime? UpdatedOn { get; set; }
        public string? Status { get; set; }
        public bool? HasChanges { get; set; }
        public List<string>? Users { get; set; }
        public List<TicketMessageDto>? Messages { get; set; }
    }
}
```

### TicketMessageDto
```
namespace Mojito.Support.Model.Dtos.Help
{
    public class TicketMessageDto
    {
        public string Type { get; set; }
        public string? Author { get; set; }
        public string Message { get; set; }
        public DateTime Date { get; set; }
        public TicketAttachmentDto[]? Attachments { get; set; }
    }
}
```

### TicketAttachmentDto
```
using Microsoft.AspNetCore.Http;
namespace Mojito.Support.Model.Dtos.Help
{
    public class TicketAttachmentDto
    {
        public string? Filename { get; set; }
        public IFormFile? File { get; set; }
        public string? URI { get; set; }
    }
}
```

## Enums

### TicketMessageType
```
export enum TicketMessageType {
    System = 'system',
    Support = 'support',
    User = 'user',
    Info = 'info'
}
```

### CaseStatus
```
export enum CaseStatus {
    Created = 'created',
    Asigned = 'asigned',
    InfoPending = 'infoPending',
    ApprovalPending = 'approvalPending',
    Paused = 'paused',
    Cancelled = 'cancelled',
    Completed = 'completed'
}
```

### CaseCategory
```
export enum CaseCategory {
    Data = 'data',
    Users = 'users',
    Docs = 'docs',
    Reports = 'reports',
    Alerts = 'alerts',
    Other = 'other'
}
```

### CaseSubcategory
```
export enum CaseSubcategory {
    Loads = 'loads',
    Modifications = 'modifications',
    Integrations = 'integrations',
    Mappings = 'mappings',
    Doctypes = 'doctypes',
    Uploads = 'uploads',
    Access = 'access',
    Permissions = 'permissions',
    Claims = 'claims'
}
```
